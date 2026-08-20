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
  index = targetIndex;
  turning = false;

  /*
    The full target spread has already been
    sitting underneath the entire animation.

    Make it the permanent spread without
    creating a new image element.
  */
  const targetSpread =
    transitionLayer.querySelector(".target-spread");

  if (targetSpread) {
    currentLayer.innerHTML = targetSpread.innerHTML;
  }

  /*
    Keep the transition in place for one painted
    frame so the permanent layer is guaranteed
    to be visible before anything above it disappears.
  */
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      transitionLayer.innerHTML = "";
      transitionLayer.className = "transition";

      updateControls();

      if (pendingDirection) {
        const nextDirection = pendingDirection;
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
  if (coverAnimating) return;

  if (closed) {
    if (direction === "next") {
      openBook();
    }

    return;
  }

  if (
    direction === "previous" &&
    index === 0
  ) {
    closeBook();
    return;
  }

  if (turning) {
    if (
      pendingDirection &&
      pendingDirection !== direction
    ) {
      pendingDirection = null;
    } else {
      pendingDirection = direction;
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
    index = targetIndex;
    render();
    return;
  }

  turning = true;

  const current =
    spreads[index];

  const target =
    spreads[targetIndex];

  const isNext =
    direction === "next";

  /*
    NEW CONSTRUCTION

    The COMPLETE TARGET SPREAD is placed
    underneath from the very beginning.

    NEXT:
    - target spread underneath
    - old left page temporarily covers target left
    - old right page is front of turning sheet
    - target left page is back of turning sheet

    PREVIOUS:
    - target spread underneath
    - old right page temporarily covers target right
    - old left page is front of turning sheet
    - target right page is back of turning sheet
  */

  const stationarySide =
    isNext
      ? "left"
      : "right";

  const frontSide =
    isNext
      ? "right"
      : "left";

  const backSide =
    isNext
      ? "left"
      : "right";

  transitionLayer.innerHTML = `
    <div class="target-spread">
      ${imageMarkup(target)}
    </div>

    <div
      class="
        spread-half
        spread-half--${stationarySide}
        stationary-old-page
      "
    >
      ${imageMarkup(current)}
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
    transitionLayer.querySelector(".flap");

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
