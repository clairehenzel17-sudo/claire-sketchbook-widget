# Claire Henzel sketchbook widget

A standalone, dependency-free page-turning sketchbook for embedding in Readymag. The `henry james` PDF defines the vintage cover, tall page proportions and paper treatment; it is not portfolio content.

## Final artwork

Claire's eight final A4 scans live in `assets/final/` and are paired in numerical order. `scripts/build_spreads.py` samples each scan's paper stock, carries that colour and texture through its corresponding notebook leaf, and applies a deterministic perspective bend without generatively altering the drawing or its text.

The animation clips the same full-spread raster into stationary and moving halves, so artwork, paper edge, and fold stay continuous. The closed A4 cloth cover opens from the centre and can be closed again by navigating left from the first spread.

The Henry James PDF supplies only the photographed notebook form. The visible artwork is exclusively Claire's supplied final scans.

## Preview locally

From this directory, run:

```sh
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/`.

## Readymag installation

Host this directory at a stable HTTPS URL, then paste an iframe pointing to that URL into Readymag's Code widget. The iframe should have a 16:9 content area and no border. Test the published project at desktop, tablet and mobile widths before mapping the final domain.
