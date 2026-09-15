/**
 * Fretboard.js
 * A zero-dependency, plain-JS plugin that renders a guitar fretboard
 * as SVG and labels every note on it.
 *
 * Usage:
 *   const fb = new Fretboard(document.getElementById('container'), {
 *     frets: 12,
 *     tuning: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'], // low to high, string 6 -> 1
 *     leftHanded: false,
 *     showOpenStrings: true,
 *     labelMode: 'note',   // 'note' | 'degree' | 'none'
 *     highlight: null,     // e.g. { notes: ['C', 'E', 'G'], root: 'C' }
 *     fretTaper: 0,        // 0 (default) = equidistant frets. As this
 *                          // increases above 0, the gradient of narrowing
 *                          // toward the body increases — 1 reproduces true
 *                          // guitar fret spacing (12 semitones per octave),
 *                          // values above 1 exaggerate the taper further,
 *                          // unbounded above.
 *   });
 *
 *   fb.setHighlight({ notes: ['A', 'C', 'E'], root: 'A' });
 *   fb.setFrets(15);
 *   fb.setTuning(['D2', 'A2', 'D3', 'G3', 'A3', 'D4']); // drop D-ish example
 *   fb.setFretTaper(1);   // true guitar taper
 *   fb.setFretTaper(2.5); // more dramatic than real life
 *   fb.setFretTaper(0);   // back to equidistant
 *   fb.destroy();
 */

(function (global) {
	'use strict';

	var SVG_NS = 'http://www.w3.org/2000/svg';

	var NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	var NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

	// Standard single-dot fret markers (guitar convention), plus double dot at 12/24.
	var SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
	var DOUBLE_DOT_FRETS = [12, 24];

	var DEFAULT_TUNING = ['E2', 'A2', 'D3', 'G3', 'B3', 'E4']; // standard, low to high

	/* ---------------------------------------------------------------- */
	/* Note-name / MIDI helpers                                          */
	/* ---------------------------------------------------------------- */

	function noteNameToMidi(name) {
		// Accepts things like 'E2', 'F#3', 'Bb2'
		var match = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(name.trim());
		if (!match) {
			throw new Error('Fretboard: invalid note name "' + name + '"');
		}
		var letter = match[1].toUpperCase();
		var accidental = match[2];
		var octave = parseInt(match[3], 10);

		var base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
		if (accidental === '#') base += 1;
		if (accidental === 'b') base -= 1;

		// MIDI note number, using the common convention where C4 = 60.
		return base + (octave + 1) * 12;
	}

	function midiToNoteName(midi, preferFlats) {
		var names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
		var pitchClass = ((midi % 12) + 12) % 12;
		var octave = Math.floor(midi / 12) - 1;
		return { name: names[pitchClass], pitchClass: pitchClass, octave: octave, label: names[pitchClass] + octave };
	}

	/* ---------------------------------------------------------------- */
	/* SVG helpers                                                        */
	/* ---------------------------------------------------------------- */

	function svgEl(tag, attrs) {
		var el = document.createElementNS(SVG_NS, tag);
		if (attrs) {
			for (var key in attrs) {
				if (Object.prototype.hasOwnProperty.call(attrs, key)) {
					el.setAttribute(key, attrs[key]);
				}
			}
		}
		return el;
	}

	function clear(el) {
		while (el.firstChild) el.removeChild(el.firstChild);
	}

	/* ---------------------------------------------------------------- */
	/* Fretboard                                                          */
	/* ---------------------------------------------------------------- */

	function Fretboard(container, options) {
		if (!container) {
			throw new Error('Fretboard: a container element is required');
		}
		this.container = container;
		this.options = this._mergeOptions(options || {});
		this._build();
	}

	Fretboard.prototype._mergeOptions = function (opts) {
		return {
			frets: opts.frets || 12,
			tuning: opts.tuning || DEFAULT_TUNING.slice(),
			leftHanded: !!opts.leftHanded,
			showOpenStrings: opts.showOpenStrings !== false,
			labelMode: opts.labelMode || 'note', // 'note' | 'degree' | 'none'
			preferFlats: !!opts.preferFlats,
			highlight: opts.highlight || null, // { notes: [...], root: 'C' }
			fretWidth: opts.fretWidth || 64,
			stringSpacing: opts.stringSpacing || 34,
			nutWidth: opts.nutWidth || 14,
			padding: opts.padding || 28,
			// Controls how much fret-to-fret distance shrinks moving from the
			// nut toward the body (left to right), the way it does on a real
			// guitar neck. 0 or omitted: every fret is the same width
			// (equidistant). As this increases above 0, the gradient of the
			// narrowing increases — fret 1 gets relatively wider and later
			// frets get relatively narrower. fretTaper:1 reproduces true
			// guitar fret spacing (12 semitones per octave, fret 12 at
			// exactly half the scale length); values above 1 exaggerate the
			// taper further in the same direction, with no upper bound.
			// `opts.fretTaper == null` (not `!opts.fretTaper`) so an
			// explicitly-passed 0 is preserved rather than defaulted away.
			fretTaper: opts.fretTaper == null ? 0 : opts.fretTaper,
		};
	};

	Fretboard.prototype._build = function () {
		clear(this.container);
		this.svg = svgEl('svg', { class: 'fretboard-svg' });
		this.container.appendChild(this.svg);
		this._render();
	};

	Fretboard.prototype._dims = function () {
		var o = this.options;
		var numStrings = o.tuning.length;
		// boardWidth is derived from _fretX itself (not recomputed
		// separately) so this can never disagree with where frets are
		// actually drawn, at any fretTaper value. _fretX already folds in
		// nutWidth internally, so it is not added again here.
		var boardWidth = this._fretX(0, o.frets);
		var boardHeight = (numStrings - 1) * o.stringSpacing;
		var width = boardWidth + o.padding * 2 + (o.showOpenStrings ? o.fretWidth * 0.55 : 0);
		var height = boardHeight + o.padding * 2 + 28; // extra for fret-number row
		return { numStrings: numStrings, boardWidth: boardWidth, boardHeight: boardHeight, width: width, height: height };
	};

	Fretboard.prototype._render = function () {
		var o = this.options;
		var d = this._dims();

		this.svg.setAttribute('viewBox', '0 0 ' + d.width + ' ' + d.height);
		this.svg.setAttribute('width', '100%');
		this.svg.setAttribute('role', 'img');
		this.svg.setAttribute('aria-label', 'Guitar fretboard diagram, ' + o.frets + ' frets');

		clear(this.svg);

		var openStringGutter = o.showOpenStrings ? o.fretWidth * 0.55 : 0;
		var boardX = o.padding + openStringGutter;
		var boardY = o.padding;

		var boardGroup = svgEl('g', { class: 'fretboard-board' });
		this.svg.appendChild(boardGroup);

		// Fretboard body background.
		boardGroup.appendChild(this._rect(boardX, boardY, d.boardWidth - o.nutWidth, d.boardHeight, 'fretboard-wood', 3));

		this._drawFretMarkers(boardGroup, boardX, boardY, d);
		this._drawFrets(boardGroup, boardX, boardY, d);
		this._drawNut(boardGroup, boardX, boardY, d);
		this._drawStrings(boardGroup, boardX, boardY, d);
		this._drawFretNumbers(boardGroup, boardX, boardY, d);
		if (o.showOpenStrings) this._drawOpenStrings(boardGroup, boardX, boardY, d, openStringGutter);
		this._drawNotes(boardGroup, boardX, boardY, d, openStringGutter);
	};

	Fretboard.prototype._rect = function (x, y, w, h, cls, rx) {
		var r = svgEl('rect', { x: x, y: y, width: w, height: h, class: cls });
		if (rx) r.setAttribute('rx', rx);
		return r;
	};

	// Fret positions are computed as a blend between two normalized curves
	// along [0, 1] across the fretboard, then scaled to actual board width:
	//   - equidistantPos(n): n / totalFrets            (a straight line)
	//   - guitarPos(n):      (1 - 2^(-n/12)) / (1 - 2^(-totalFrets/12))
	//     (the true equal-tempered guitar curve — 12 semitones per octave —
	//     renormalized so it also reaches exactly 1 at the last fret)
	// blendedPos(n) = equidistantPos(n) + fretTaper * (guitarPos(n) - equidistantPos(n))
	// At fretTaper:0 this reduces exactly to equidistantPos (verified:
	// the guitarPos term is multiplied by zero). At fretTaper:1 it reduces
	// exactly to guitarPos — true guitar spacing. Values above 1 extrapolate
	// past the real-guitar curve in the same direction (steeper gradient,
	// unbounded). Both curves are pinned to reach 1 at the last fret, so
	// whatever fretTaper is, the last fret always lands at the same x for a
	// given fretWidth/frets — only the frets in between reshape.
	Fretboard.prototype._equidistantPos = function (fretIndex) {
		return fretIndex / this.options.frets;
	};

	Fretboard.prototype._guitarPos = function (fretIndex) {
		var totalFrets = this.options.frets;
		var raw = function (n) { return 1 - Math.pow(2, -n / 12); };
		return raw(fretIndex) / raw(totalFrets);
	};

	Fretboard.prototype._blendedPos = function (fretIndex) {
		var equidistant = this._equidistantPos(fretIndex);
		var guitar = this._guitarPos(fretIndex);
		return equidistant + this.options.fretTaper * (guitar - equidistant);
	};

	Fretboard.prototype._fretX = function (boardX, fretIndex) {
		var o = this.options;
		// Note: the nut-to-fret-1 distance legitimately differs from the
		// fret-to-fret distances that follow. The nut is a physical
		// component with its own width (nutWidth), not the first interval
		// in the tapered/equidistant fret sequence — a real guitar's nut
		// isn't sized by the fret-spacing formula either. Only frets 1..N
		// against each other follow the taper curve.
		if (fretIndex === 0) return boardX; // nut position
		var totalBoardSpan = o.frets * o.fretWidth; // last fret always lands here, any fretTaper
		return boardX + o.nutWidth + this._blendedPos(fretIndex) * totalBoardSpan;
	};

	Fretboard.prototype._fretCenterX = function (boardX, fretIndex) {
		var o = this.options;
		if (fretIndex === 0) return boardX - o.fretWidth * 0.3; // open-string position (left of nut)
		var left = fretIndex === 1 ? boardX + o.nutWidth : this._fretX(boardX, fretIndex - 1);
		var right = this._fretX(boardX, fretIndex);
		return (left + right) / 2;
	};

	Fretboard.prototype._stringY = function (boardY, stringIndex) {
		// tuning[] is ordered low to high (index 0 = lowest-pitched string).
		// On a real fretboard viewed as a player looks down at it, the lowest
		// string sits nearest the player (bottom of the diagram) and the
		// highest string sits farthest (top) — so we draw index 0 at the
		// bottom and invert upward from there.
		var numStrings = this.options.tuning.length;
		return boardY + (numStrings - 1 - stringIndex) * this.options.stringSpacing;
	};

	Fretboard.prototype._drawFrets = function (group, boardX, boardY, d) {
		var o = this.options;
		var g = svgEl('g', { class: 'fretboard-frets' });
		group.appendChild(g);
		for (var i = 1; i <= o.frets; i++) {
			var x = this._fretX(boardX, i);
			g.appendChild(
				svgEl('line', {
					x1: x,
					y1: boardY,
					x2: x,
					y2: boardY + d.boardHeight,
					class: 'fretboard-fretwire',
				})
			);
		}
	};

	Fretboard.prototype._drawNut = function (group, boardX, boardY, d) {
		var o = this.options;
		group.appendChild(
			svgEl('rect', {
				x: boardX,
				y: boardY,
				width: o.nutWidth,
				height: d.boardHeight,
				class: 'fretboard-nut',
			})
		);
	};

	Fretboard.prototype._drawStrings = function (group, boardX, boardY, d) {
		var o = this.options;
		var g = svgEl('g', { class: 'fretboard-strings' });
		group.appendChild(g);
		var openStringGutter = o.showOpenStrings ? o.fretWidth * 0.55 : 0;
		var startX = o.showOpenStrings ? boardX - openStringGutter : boardX;
		for (var i = 0; i < d.numStrings; i++) {
			var y = this._stringY(boardY, i);
			// Thickness is keyed to pitch (tuning-array index), not to vertical
			// position: index 0, the lowest-pitched string, is drawn thickest
			// regardless of where _stringY places it on the diagram.
			var thickness = 1 + (d.numStrings - 1 - i) * 0.35;
			g.appendChild(
				svgEl('line', {
					x1: startX,
					y1: y,
					x2: boardX + d.boardWidth,
					y2: y,
					class: 'fretboard-string',
					'stroke-width': thickness.toFixed(2),
				})
			);
		}
	};

	Fretboard.prototype._drawFretMarkers = function (group, boardX, boardY, d) {
		var o = this.options;
		var g = svgEl('g', { class: 'fretboard-markers' });
		group.appendChild(g);
		var midY = boardY + d.boardHeight / 2;

		for (var i = 1; i <= o.frets; i++) {
			var cx = this._fretCenterX(boardX, i);
			if (DOUBLE_DOT_FRETS.indexOf(i) !== -1) {
				var offset = d.boardHeight / 4;
				g.appendChild(svgEl('circle', { cx: cx, cy: midY - offset, r: 5, class: 'fretboard-inlay' }));
				g.appendChild(svgEl('circle', { cx: cx, cy: midY + offset, r: 5, class: 'fretboard-inlay' }));
			} else if (SINGLE_DOT_FRETS.indexOf(i) !== -1) {
				g.appendChild(svgEl('circle', { cx: cx, cy: midY, r: 5, class: 'fretboard-inlay' }));
			}
		}
	};

	Fretboard.prototype._drawFretNumbers = function (group, boardX, boardY, d) {
		var o = this.options;
		var g = svgEl('g', { class: 'fretboard-fret-numbers' });
		group.appendChild(g);
		var y = boardY + d.boardHeight + 20;
		for (var i = 1; i <= o.frets; i++) {
			if (SINGLE_DOT_FRETS.indexOf(i) === -1 && DOUBLE_DOT_FRETS.indexOf(i) === -1) continue;
			var cx = this._fretCenterX(boardX, i);
			var text = svgEl('text', { x: cx, y: y, class: 'fretboard-fret-number', 'text-anchor': 'middle' });
			text.textContent = String(i);
			g.appendChild(text);
		}
	};

	Fretboard.prototype._drawOpenStrings = function (group, boardX, boardY, d, gutter) {
		var g = svgEl('g', { class: 'fretboard-open-zone' });
		group.appendChild(g);
		// A thin divider between the "open string" zone and the fretted board.
		g.appendChild(
			svgEl('line', {
				x1: boardX - gutter,
				y1: boardY - 10,
				x2: boardX - gutter,
				y2: boardY + d.boardHeight + 10,
				class: 'fretboard-open-divider',
			})
		);
	};

	Fretboard.prototype._noteAt = function (stringIndex, fretIndex) {
		var openMidi = noteNameToMidi(this.options.tuning[stringIndex]);
		var midi = openMidi + fretIndex;
		return midiToNoteName(midi, this.options.preferFlats);
	};

	Fretboard.prototype._isHighlighted = function (noteInfo) {
		var h = this.options.highlight;
		if (!h || !h.notes || !h.notes.length) return { active: false, isRoot: false };
		var isRoot = !!h.root && this._sameLetter(h.root, noteInfo.name);
		var active = isRoot || h.notes.some(this._sameLetter.bind(this, noteInfo.name));
		return { active: active, isRoot: isRoot };
	};

	Fretboard.prototype._sameLetter = function (a, b) {
		// Compares by pitch class so 'C#'/'Db' style spellings still match.
		var pcMap = {};
		NOTE_NAMES_SHARP.forEach(function (n, idx) { pcMap[n] = idx; });
		NOTE_NAMES_FLAT.forEach(function (n, idx) { pcMap[n] = idx; });
		return pcMap[a] === pcMap[b];
	};

	Fretboard.prototype._drawNotes = function (group, boardX, boardY, d, gutter) {
		var o = this.options;
		if (o.labelMode === 'none') return;
		var g = svgEl('g', { class: 'fretboard-notes' });
		group.appendChild(g);

		var startFret = o.showOpenStrings ? 0 : 1;
		for (var s = 0; s < d.numStrings; s++) {
			var y = this._stringY(boardY, s);
			for (var f = startFret; f <= o.frets; f++) {
				var cx = this._fretCenterX(boardX, f);
				var noteInfo = this._noteAt(s, f);
				var h = this._isHighlighted(noteInfo);

				if (o.highlight && !h.active) continue; // when a highlight set is given, only show matches

				var dotClass = 'fretboard-note-dot' + (h.isRoot ? ' fretboard-note-dot--root' : h.active ? ' fretboard-note-dot--highlight' : '');
				g.appendChild(svgEl('circle', { cx: cx, cy: y, r: 11, class: dotClass }));

				if (o.labelMode !== 'none') {
					var text = svgEl('text', {
						x: cx,
						y: y + 4,
						class: 'fretboard-note-label' + (h.isRoot ? ' fretboard-note-label--root' : ''),
						'text-anchor': 'middle',
					});
					text.textContent = noteInfo.name;
					g.appendChild(text);
				}
			}
		}
	};

	/* ---------------------------------------------------------------- */
	/* Public API                                                         */
	/* ---------------------------------------------------------------- */

	Fretboard.prototype.setFrets = function (frets) {
		this.options.frets = frets;
		this._render();
	};

	Fretboard.prototype.setTuning = function (tuning) {
		this.options.tuning = tuning.slice();
		this._render();
	};

	Fretboard.prototype.setHighlight = function (highlight) {
		this.options.highlight = highlight;
		this._render();
	};

	Fretboard.prototype.setLabelMode = function (mode) {
		this.options.labelMode = mode;
		this._render();
	};

	// Controls how much fret-to-fret distance shrinks toward the body.
	// 0 (the default): every fret is the same width. Increasing above 0
	// increases the gradient of narrowing; 1 reproduces true guitar fret
	// spacing; values above 1 exaggerate the taper further, unbounded.
	// Negative values aren't defined for this parameter, so they're rejected
	// rather than silently producing an inverted or undefined shape.
	Fretboard.prototype.setFretTaper = function (taper) {
		if (typeof taper !== 'number' || isNaN(taper) || taper < 0) {
			throw new Error('Fretboard: fretTaper must be a number >= 0, got ' + taper);
		}
		this.options.fretTaper = taper;
		this._render();
	};

	Fretboard.prototype.setOptions = function (partialOptions) {
		this.options = this._mergeOptions(Object.assign({}, this.options, partialOptions));
		this._render();
	};

	Fretboard.prototype.getSVG = function () {
		return this.svg;
	};

	Fretboard.prototype.destroy = function () {
		clear(this.container);
		this.svg = null;
	};

	// Expose a couple of the note helpers for host pages that want to
	// build their own highlight sets (e.g. "give me the notes of C major").
	Fretboard.noteNameToMidi = noteNameToMidi;
	Fretboard.midiToNoteName = midiToNoteName;

	/* ---------------------------------------------------------------- */
	/* Export                                                             */
	/* ---------------------------------------------------------------- */

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = Fretboard;
	} else {
		global.Fretboard = Fretboard;
	}
})(typeof window !== 'undefined' ? window : this);
