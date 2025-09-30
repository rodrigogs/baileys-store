module.exports = {
	'roots': [
		'<rootDir>/src'
	],
	'testMatch': [
		'**/Tests/test.*.+(ts|tsx|js)',
	],
	'transform': {
		'^.+\\.(ts|tsx)$': ['ts-jest', { useESM: true }]
	},
	'extensionsToTreatAsEsm': ['.ts'],
	globals: {
		'ts-jest': {
			tsconfig: './tsconfig.json',
			useESM: true
		}
	},
	moduleNameMapper: {
		'^axios$': require.resolve('axios'),
	},
}