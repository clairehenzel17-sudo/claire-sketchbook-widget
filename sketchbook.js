(function () {
  "use strict";

  const spreads = Array.isArray(window.CLAIRE_SKETCHBOOK_SPREADS)
    ? window.CLAIRE_SKETCHBOOK_SPREADS.slice()
    : [];

  const book = document.querySelector(".book");
  const currentLayer = document.querySelector(".spread-current");
  const transitionLayer = document.querySelector(".transition");
  const coverState = document.querySelector(".cover-state");
  const caption = document.querySelector(".caption");
  const captionCurrent = document.querySelector(".caption-current");
  const captionIncoming = document.querySelector(".caption-incoming");
  const previousArrow = document.querySelector(".arrow--previous");
  const nextArrow = document.querySelector(".arrow--next");
  const previousZone = document.querySelector(".page-zone--previous");
  const nextZone = document.querySelector(".page-zone--next");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let index = 0;
  let closed = true;
  let coverAnimating = false;
  let turning = false;
  let pendingDirection = null;
  let blurTimers = [];

  function imageMarkup(spread) {
    return `<img class="spread-image" src="${spread.src}" alt="" draggable="false">`;
  }

  function halfMarkup(spread, side, state) {
    return `<div class="spread-half spread-half--${side} spread-${state}">${imageMarkup(spread)}</div>`;
  }

  function faceMarkup(spread, side, back) {
    return `<div class="face face--${side}${back ? " face--back" : ""}">${imageMarkup(spread)}</div>`;
  }

  function updateControls() {
    // While a page is moving, both directions stay receptive so a quick change
    // of mind is queued instead of being swallowed by a temporarily stale edge.
    if (coverAnimating) {
      previousArrow.disabled = true;
      previousZone.disabled = true;
      nextArrow.disabled = true;
      nextZone.disabled = true;
      return;
    }
    const atStart = closed;
    const atEnd = !closed && !turning && index === spreads.length - 1;
    previousArrow.disabled = atStart;
    previousZone.disabled = atStart;
    nextArrow.disabled = atEnd;
    nextZone.disabled = atEnd;
    coverState.disabled = !closed;
  }

  function render() {
    const spread = spreads[index];
    currentLayer.innerHTML = spread ? imageMarkup(spread) : "";
    captionCurrent.textContent = closed ? "Sketchbook" : (spread ? spread.caption : "");
    captionIncoming.textContent = "";
    book.setAttribute("aria-label", closed
      ? "Closed sketchbook"
      : `Sketchbook spread ${index + 1} of ${spreads.length}: ${spread ? spread.caption : ""}`);
    updateControls();
  }

  function finishCover(nextClosed) {
    coverAnimating = false;
    closed = nextClosed;
    book.classList.remove("is-opening", "is-closing");
    book.classList.toggle("is-closed", closed);
    caption.classList.remove("is-changing");
    render();
    if (!closed && document.activeElement === coverState) nextArrow.focus({ preventScroll: true });
    if (closed && document.activeElement === previousArrow) nextArrow.focus({ preventScroll: true });
  }

  function openBook() {
    if (!closed || coverAnimating) return;
    if (reduceMotion.matches) {
      finishCover(false);
      return;
    }
    coverAnimating = true;
    book.classList.remove("is-closed");
    book.classList.add("is-opening");
    captionIncoming.textContent = spreads[0].caption;
    caption.classList.add("is-changing");
    updateControls();
    coverState.addEventListener("animationend", () => finishCover(false), { once: true });
  }

  function closeBook() {
    if (closed || coverAnimating || turning || index !== 0) return;
    if (reduceMotion.matches) {
      finishCover(true);
      return;
    }
    coverAnimating = true;
    coverState.disabled = false;
    book.classList.add("is-closing");
    captionIncoming.textContent = "Sketchbook";
    caption.classList.add("is-changing");
    updateControls();
    coverState.addEventListener("animationend", () => finishCover(true), { once: true });
  }

  function clearBlur() {
    blurTimers.forEach(window.clearTimeout);
    blurTimers = [];
    transitionLayer.classList.remove("blur-one", "blur-two");
  }

  function scheduleBlur() {
    const set = (delay, className) => window.setTimeout(() => {
      transitionLayer.classList.remove("blur-one", "blur-two");
      if (className) transitionLayer.classList.add(className);
    }, delay);
    blurTimers = [set(130, "blur-one"), set(280, "blur-two"), set(510, "blur-one"), set(690, "")];
  }

  function complete(targetIndex) {
    clearBlur();
    index = targetIndex;
    turning = false;
    transitionLayer.innerHTML = "";
    transitionLayer.className = "transition";
    caption.classList.remove("is-changing");
    render();
    if (pendingDirection) {
      const nextDirection = pendingDirection;
      pendingDirection = null;
      requestAnimationFrame(() => turn(nextDirection));
    }
  }

  function turn(direction) {
    if (coverAnimating) return;
    if (closed) {
      if (direction === "next") openBook();
      return;
    }
    if (direction === "previous" && index === 0) {
      closeBook();
      return;
    }
    if (turning) {
      // A burst represents the latest intention, not a list of page turns to
      // replay. Opposing taps cancel, while repeated taps request one more turn.
      if (pendingDirection && pendingDirection !== direction) pendingDirection = null;
      else pendingDirection = direction;
      return;
    }

    const targetIndex = index + (direction === "next" ? 1 : -1);
    if (targetIndex < 0 || targetIndex >= spreads.length) return;

    if (reduceMotion.matches) {
      index = targetIndex;
      render();
      return;
    }

    turning = true;
    const current = spreads[index];
    const target = spreads[targetIndex];
    const isNext = direction === "next";
    const outgoingSide = isNext ? "left" : "right";
    const incomingSide = isNext ? "right" : "left";
    const frontSide = isNext ? "right" : "left";
    const backSide = isNext ? "left" : "right";

    currentLayer.innerHTML = "";
    transitionLayer.innerHTML =
      halfMarkup(current, outgoingSide, "out") +
      halfMarkup(target, incomingSide, "in") +
      `<div class="flap flap--${direction}">${faceMarkup(current, frontSide, false)}${faceMarkup(target, backSide, true)}</div>`;
    captionIncoming.textContent = target.caption;
    caption.classList.add("is-changing");
    scheduleBlur();
    updateControls();

    const flap = transitionLayer.querySelector(".flap");
    flap.addEventListener("animationend", () => complete(targetIndex), { once: true });
  }

  previousArrow.addEventListener("click", () => turn("previous"));
  nextArrow.addEventListener("click", () => turn("next"));
  previousZone.addEventListener("click", () => turn("previous"));
  nextZone.addEventListener("click", () => turn("next"));
  coverState.addEventListener("click", openBook);

  document.querySelector(".sketchbook").addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); turn("previous"); }
    if (event.key === "ArrowRight") { event.preventDefault(); turn("next"); }
  });

  spreads.forEach((spread) => {
    const image = new Image();
    image.src = spread.src;
  });

  book.classList.add("is-closed");
  render();
}());
