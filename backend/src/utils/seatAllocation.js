/**
 * Generates seat labels in the "A-01, A-02, ... A-50, B-01, ..." pattern
 * (50 seats per row). Rows beyond Z continue as AA, AB, ... (same scheme
 * spreadsheet columns use), so this works for any realistic event
 * capacity without ever running out of labels.
 */
const SEATS_PER_ROW = 50;

const rowLetters = (rowIndex) => {
  // rowIndex is 0-based (0 -> 'A', 25 -> 'Z', 26 -> 'AA', ...)
  let n = rowIndex + 1;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
};

/**
 * Converts a 1-based seat index (1, 2, 3, ...) into its label, e.g.
 * seatLabelForIndex(1) -> 'A-01', seatLabelForIndex(51) -> 'B-01'.
 */
const seatLabelForIndex = (index) => {
  const rowIndex = Math.floor((index - 1) / SEATS_PER_ROW);
  const seatInRow = ((index - 1) % SEATS_PER_ROW) + 1;
  return `${rowLetters(rowIndex)}-${String(seatInRow).padStart(2, '0')}`;
};

/**
 * Finds the first seat label (in seat order: A-01, A-02, ...) that is NOT
 * already in `takenSeatLabels`. This naturally fills gaps left by
 * cancellations — if A-05 is freed up by a cancellation, the next person
 * to register gets A-05 back rather than always growing toward the end.
 *
 * Returns null if every seat up to `capacity` is taken (caller should
 * already have checked the active-registration count against capacity
 * before calling this, so null here would indicate a logic error rather
 * than a normal "event full" case).
 */
const findFirstAvailableSeat = (capacity, takenSeatLabels) => {
  const taken = new Set(takenSeatLabels);
  for (let i = 1; i <= capacity; i += 1) {
    const label = seatLabelForIndex(i);
    if (!taken.has(label)) {
      return label;
    }
  }
  return null;
};

module.exports = { seatLabelForIndex, findFirstAvailableSeat };
