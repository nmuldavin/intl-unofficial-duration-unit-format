// @flow
import IntlMessageFormat from 'intl-messageformat';
import trim from './lib/trim';

function DurationUnitFormat(locales: string | Array<string>, options?: Options = defaultOptions) {
  this.locales = locales;
  // TODO I'm ignoring the unit for now, value is always expressed in seconds
  this.unit = 'second';
  this.isTimer = options.style === DurationUnitFormat.styles.TIMER;
  this.format = options.format || (this.isTimer ? '{minutes}:{seconds}' : '{seconds}');
  this.formatUnits = (options || defaultOptions).formatUnits || defaultOptions.formatUnits;
  this.formatDuration = options.formatDuration || defaultOptions.formatDuration;
  this.shouldRound = options.round === true;
}

DurationUnitFormat.units = {
  DAY: 'day',
  HOUR: 'hour',
  MINUTE: 'minute',
  SECOND: 'second',
};

DurationUnitFormat.styles = {
  CUSTOM: 'custom',
  // TODO eventually maybe implement these? from cldr
  // http://www.unicode.org/cldr/charts/27/summary/pl.html#5556
  // LONG: 'long',
  // SHORT: 'short',
  // NARROW: 'narrow',
  TIMER: 'timer',
};

DurationUnitFormat.prototype.formatToParts = function (value: number) {
  const seconds = initialValue(value, this.unit, this.format, this.shouldRound);
  const tokens = {};
  const parts = [];

  [
    DurationUnitFormat.units.DAY,
    DurationUnitFormat.units.HOUR,
    DurationUnitFormat.units.MINUTE,
    DurationUnitFormat.units.SECOND,
  ].reduce((leftToFormat, unit) => this._formatTokens(tokens, unit, leftToFormat), seconds);

  // Go from the biggest possible unit because it doesn't depend on lower units
  this.format.split(SPLIT_FORMAT).map((text) => {
    if (SPLIT_FORMAT.test(text)) {
      const unit = (text.match(EXTRACT_UNIT) || [])[1];
      if (tokens[unit]) {
        parts.push.apply(parts, tokens[unit]);
      }
    } else if (text) {
      parts.push({ type: 'literal', value: text });
    }
  });

  const trimmed = trim(parts, this.isTimer);
  if (trimmed.length === 0) {
    // if everything cancels out, return 0 on the lowest available unit
    const minUnit = [
      DurationUnitFormat.units.SECOND,
      DurationUnitFormat.units.MINUTE,
      DurationUnitFormat.units.HOUR,
      DurationUnitFormat.units.DAY,
    ].find((unit) => has(this.format, unit));
    return this._formatDurationToParts(minUnit, 0);
  }
  return trimmed;
};

DurationUnitFormat.prototype._formatTokens = function(tokens, unit, seconds) {
  const chunk = has(this.format, unit) ? Math.floor(seconds / SECONDS_IN[unit]) : 0;
  if (chunk || this.isTimer) {
    tokens[unit] = this._formatDurationToParts(unit, chunk);
  }
  return seconds - chunk * SECONDS_IN[unit];
};

DurationUnitFormat.prototype._formatDurationToParts = function(unit, number) {
  return this.formatDuration.split(SPLIT_POINTS).map((text) => {
    if (text === '{value}') {
      return { type: unit, value: this._formatValue(number) };
    }
    if (this.isTimer) {
      // With timer style, we only show the value
      return;
    }
    if (text === '{unit}') {
      const message = this.formatUnits[unit] || '{value}';
      const formattedUnit = new IntlMessageFormat(message, this.locales).format({ value: number });
      return { type: 'unit', value: formattedUnit };
    }
    if (text) {
      return { type: 'literal', value: text };
    }
  }).filter(Boolean);
}

DurationUnitFormat.prototype._formatValue = function (number) {
  return this.isTimer ? number.toString().padStart(2, '0') : number.toString();
}

type Options = {|
  // unit: $Values<typeof DurationUnitFormat.units>,
  format?: string,
  formatDuration?: string,
  formatUnits?: { [$Values<typeof DurationUnitFormat.units>]: string },
  round?: boolean,
  style?: $Values<typeof DurationUnitFormat.styles>,
|}
const defaultOptions = {
  // unit: DurationUnitFormat.units.SECOND,
  formatDuration: '{value} {unit}',
  formatUnits: {
    [DurationUnitFormat.units.DAY]: '{value, plural, one {day} other {days}}',
    [DurationUnitFormat.units.HOUR]: '{value, plural, one {hour} other {hours}}',
    [DurationUnitFormat.units.MINUTE]: '{value, plural, one {minute} other {minutes}}',
    [DurationUnitFormat.units.SECOND]: '{value, plural, one {second} other {seconds}}',
  },
  round: false,
  style: DurationUnitFormat.styles.CUSTOM,
};

const SPLIT_POINTS = /(\{value\}|\{unit\})/;
const SPLIT_FORMAT = new RegExp(
  '('
  + Object.keys(DurationUnitFormat.units)
    .map((key) => `\\{${DurationUnitFormat.units[key]}\\}|\\{${DurationUnitFormat.units[key]}s\\}`)
    .join('|')
  + ')',
);
const EXTRACT_UNIT = new RegExp(
  '\\{('
  + Object.keys(DurationUnitFormat.units)
    .map((key) => DurationUnitFormat.units[key])
    .join('|')
  + ')s?\\}',
);

const SECONDS_IN = {
  day: 24 * 60 * 60,
  hour: 60 * 60,
  minute: 60,
  second: 1,
};

function has(format, unit) {
  return format.indexOf(`{${unit}}`) !== -1 || format.indexOf(`{${unit}s}`) !== -1;
}

function initialValue(value, valueUnit, format, shouldRound) {
  const initial = value * SECONDS_IN[valueUnit];
  if (!shouldRound) return initial;

  let hasLowerUnit = has(format, DurationUnitFormat.units.SECOND);
  return [
    DurationUnitFormat.units.MINUTE,
    DurationUnitFormat.units.HOUR,
    DurationUnitFormat.units.DAY,
  ].reduce((seconds, unit) => {
    if (hasLowerUnit) {
      return seconds;
    } else {
      hasLowerUnit = has(format, unit);
      return Math.round(seconds / SECONDS_IN[unit]) * SECONDS_IN[unit];
    }
  }, initial);
}

export default DurationUnitFormat;
