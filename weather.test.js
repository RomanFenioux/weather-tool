const { getTempScore, getWindScore, getPrecipScore, computeLinearRating, getWeatherCondition } = require('./script');

describe('computeLinearRating parametrization', () => {
    // [inputValue, bestValue, worstValue, expected]
    test.each([
        [0, 10, 0, 0],
        [5, 10, 0, 0.5],
        [0, 0, 10, 1],
    ])(
        'input=%i when best is %i and worst is %i should get score %f',
        (input, best, worst, expected) => {
            expect(computeLinearRating(input, best, worst)).toBe(expected);
        }
    );
});

describe('getTempScore parametrization', () => {
    test.each([
        // [temp, expected]
        [-5, 0],    // too cold
        [0, 0],     // too cold
        [10, 1],    // good temperature
        [15, 1],    // good temperature
        [20, 1],    // good temperature
        [35, 0],    // too hot
        [40, 0],    // too hot
    ])(
        'temp=%i, should get score %i',
        (temp, expected) => {
            expect(getTempScore(temp)).toBe(expected);
        }
    );
});

describe('getWindScore parametrization', () => {
    // [windSpeed, expected]
    test.each([
        [0, 1],
        [5, 1],
        [50, 0],
        [55, 0],
    ])(
        'wind speed=%i, should get score %i',
        (temp, expected) => {
            expect(getWindScore(temp)).toBe(expected);
        }
    );
});

describe('getPrecipScore parametrization', () => {
    // [precipSum, expected]
    test.each([
        // [temp, prob, sum, wind, code, expected]
        [0, 1],
        [10, 0],
        [12, 0],
    ])(
        'precipitation sum =%i, should get score %i',
        (temp, expected) => {
            expect(getPrecipScore(temp)).toBe(expected);
        }
    );
});

test('Cold and rainy should be "bad"', () => {
    const result = getWeatherCondition(2, 10, 10, 5);
    expect(result).toBe('bad');
});

test('Dry weather with good temp should be "good"', () => {
    const result = getWeatherCondition(15, 0, 10, 1);
    expect(result).toBe('good');
});