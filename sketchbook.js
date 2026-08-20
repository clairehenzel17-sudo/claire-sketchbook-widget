(function () {
  "use strict";


  /* ----------------------------------
     DATA
  ---------------------------------- */

  const spreads =
    Array.isArray(window.CLAIRE_SKETCHBOOK_SPREADS)
      ? window.CLAIRE_SKETCHBOOK_SPREADS.slice()
      : [];


  /* ----------------------------------
     ELEMENTS
  ---------------------------------- */

  const book =
    document.querySelector(".book");

  const currentLayer =
    document.querySelector(".spread-current");

  const transitionLayer =
    document.querySelector(".transition");

  const coverState =
    document.querySelector(".cover-state");

  const previousArrow =
    document.querySelector(".arrow--previous");

  const nextArrow =
    document.querySelector(".arrow--next");

  const previousZone =
    document.querySelector(".page-zone--previous");

  const nextZone =
    document.querySelector(".page-zone--next");

  const reduceMotion =
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );


  /* ----------------------------------
     STATE
  ---------------------------------- */

  let index = 0;

  let closed = true;

  let coverAnimating = false;

  let turning = false;

  let pendingDirection = null;


  /* ----------------------------------
     MARKUP HELPERS
  ---------------------------------- */

  function imageMarkup(spread) {

    return `
      <img
        class="spread-image"
        src="${spread.src}"
        alt=""
        draggable="false"
      >
    `;

  }


  function faceMarkup(
    spread,
    side,
    back
  ) {

    return `
      <div
        class="
          face
          face--${side}
          ${back ? "face--back" : ""}
        "
      >
        ${imageMarkup(spread)}
      </div>
    `;

  }


  /* ----------------------------------
     CONTROLS
  ---------------------------------- */

  function updateControls() {

    if (coverAnimating) {

      previousArrow.disabled = true;

      previousZone.disabled = true;

      nextArrow.disabled = true;

      nextZone.disabled = true;

      return;

    }


    const atStart =
      closed;


    const atEnd =
      !closed &&
      !turning &&
      index === spreads.length - 1;


    previousArrow.disabled =
      atStart;


    previousZone.disabled =
      atStart;


    nextArrow.disabled =
      atEnd;


    nextZone.disabled =
      atEnd;


    coverState.disabled =
      !closed;

  }


  /* ----------------------------------
     STATIC SPREAD
  ---------------------------------- */

  function render() {

    const spread =
      spreads[index];


    currentLayer.innerHTML =
      spread
        ? imageMarkup(spread)
        : "";


    book.setAttribute(
      "aria-label",

      closed

        ? "Closed sketchbook"

        : `Sketchbook spread ${index + 1} of ${spreads.length}`
    );


    updateControls();

  }


  /* ----------------------------------
     COVER
  ---------------------------------- */

  function finishCover(nextClosed) {

    coverAnimating = false;

    closed = nextClosed;


    book.classList.remove(
      "is-opening",
      "is-closing"
    );


    book.classList.toggle(
      "is-closed",
      closed
    );


    render();


    if (
      !closed &&
      document.activeElement === coverState
    ) {

      nextArrow.focus({
        preventScroll: true
      });

    }


    if (
      closed &&
      document.activeElement === previousArrow
    ) {

      nextArrow.focus({
        preventScroll: true
      });

    }

  }


  function openBook() {

    if (
      !closed ||
      coverAnimating
    ) {
      return;
    }


    if (reduceMotion.matches) {

      finishCover(false);

      return;

    }


    coverAnimating = true;


    book.classList.remove(
      "is-closed"
    );


    book.classList.add(
      "is-opening"
    );


    updateControls();


    coverState.addEventListener(

      "animationend",

      () => finishCover(false),

      {
        once: true
      }

    );

  }


  function closeBook() {

    if (
      closed ||
      coverAnimating ||
      turning ||
      index !== 0
    ) {
      return;
    }


    if (reduceMotion.matches) {

      finishCover(true);

      return;

    }


    coverAnimating = true;


    coverState.disabled =
      false;


    book.classList.add(
      "is-closing"
    );


    updateControls();


    coverState.addEventListener(

      "animationend",

      () => finishCover(true),

      {
        once: true
      }

    );

  }


  /* ----------------------------------
     FINISH PAGE TURN
  ---------------------------------- */
function complete(targetIndex) {

  /*
    The turning sheet is still sitting on top
    in its final position.

    FIRST change the permanent spread underneath
    to the correct new spread.
  */

  index = targetIndex;

  const spread = spreads[index];

  currentLayer.innerHTML =
    spread
      ? imageMarkup(spread)
      : "";

  book.setAttribute(
    "aria-label",
    `Sketchbook spread ${index + 1} of ${spreads.length}`
  );


  /*
    Wait until the browser has actually painted
    the correct spread underneath.

    THEN remove the temporary turning sheet.

    This eliminates the single-frame flash of
    the previous spread.
  */

  requestAnimationFrame(() => {

    requestAnimationFrame(() => {

      transitionLayer.innerHTML = "";

      transitionLayer.className = "transition";

      turning = false;

      updateControls();


      if (pendingDirection) {

        const nextDirection =
          pendingDirection;

        pendingDirection = null;

        requestAnimationFrame(
          () => turn(nextDirection)
        );

      }

    });

  });

}


  /* ----------------------------------
     PAGE TURN
  ---------------------------------- */

  function turn(direction) {

    if (coverAnimating) {
      return;
    }


    /*
      Clicking NEXT on the closed book
      opens the cover.
    */

    if (closed) {

      if (direction === "next") {
        openBook();
      }

      return;

    }


    /*
      Clicking PREVIOUS from the
      first spread closes the book.
    */

    if (
      direction === "previous" &&
      index === 0
    ) {

      closeBook();

      return;

    }


    /*
      If someone clicks again while
      a page is already turning,
      remember only their latest intent.
    */

    if (turning) {

      if (
        pendingDirection &&
        pendingDirection !== direction
      ) {

        pendingDirection =
          null;

      }

      else {

        pendingDirection =
          direction;

      }

      return;

    }


    const targetIndex =
      index +
      (
        direction === "next"
          ? 1
          : -1
      );


    if (
      targetIndex < 0 ||
      targetIndex >= spreads.length
    ) {
      return;
    }


    if (reduceMotion.matches) {

      index =
        targetIndex;


      render();

      return;

    }


    turning =
      true;


    const current =
      spreads[index];


    const target =
      spreads[targetIndex];


    const isNext =
      direction === "next";


    /*
      THIS IS THE IMPORTANT CHANGE.

      We no longer erase the current spread
      before the page animation begins.

      Instead, we construct one physical
      turning sheet.

      NEXT:

      Stationary:
      current left page

      Turning sheet FRONT:
      current right page

      Turning sheet BACK:
      next left page

      Under the turning sheet:
      next right page


      PREVIOUS:

      Stationary:
      current right page

      Turning sheet FRONT:
      current left page

      Turning sheet BACK:
      previous right page

      Under the turning sheet:
      previous left page
    */


    const underlyingSide =
      isNext
        ? "right"
        : "left";


    const frontSide =
      isNext
        ? "right"
        : "left";


    const backSide =
      isNext
        ? "left"
        : "right";


    /*
      IMPORTANT:

      currentLayer stays exactly as it is.

      That means the current spread remains
      stable behind the animation rather than
      disappearing and being recreated.
    */


    transitionLayer.innerHTML =
      `
        <div
          class="
            spread-half
            spread-half--${underlyingSide}
            spread-under
          "
        >
          ${imageMarkup(target)}
        </div>


        <div
          class="
            flap
            flap--${direction}
          "
        >

          ${faceMarkup(
            current,
            frontSide,
            false
          )}

          ${faceMarkup(
            target,
            backSide,
            true
          )}

        </div>
      `;


    updateControls();


    const flap =
      transitionLayer.querySelector(
        ".flap"
      );


    flap.addEventListener(

      "animationend",

      () => complete(targetIndex),

      {
        once: true
      }

    );

  }


  /* ----------------------------------
     CLICK EVENTS
  ---------------------------------- */

  previousArrow.addEventListener(
    "click",
    () => turn("previous")
  );


  nextArrow.addEventListener(
    "click",
    () => turn("next")
  );


  previousZone.addEventListener(
    "click",
    () => turn("previous")
  );


  nextZone.addEventListener(
    "click",
    () => turn("next")
  );


  coverState.addEventListener(
    "click",
    openBook
  );


  /* ----------------------------------
     KEYBOARD
  ---------------------------------- */

  document
    .querySelector(".sketchbook")
    .addEventListener(
      "keydown",
      (event) => {

        if (
          event.key === "ArrowLeft"
        ) {

          event.preventDefault();

          turn("previous");

        }


        if (
          event.key === "ArrowRight"
        ) {

          event.preventDefault();

          turn("next");

        }

      }
    );


  /* ----------------------------------
     PRELOAD ALL DRAWINGS

     This is important because a page's
     reverse image must already be loaded
     BEFORE it becomes visible.
  ---------------------------------- */

  spreads.forEach(
    (spread) => {

      const image =
        new Image();


      image.src =
        spread.src;

    }
  );


  /* ----------------------------------
     INITIAL STATE
  ---------------------------------- */

  book.classList.add(
    "is-closed"
  );


  render();

}());
