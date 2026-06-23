export default [
    {
        ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
    },
    {
        files: ['**/*.{js,jsx}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                alert: 'readonly',
                console: 'readonly',
                CustomEvent: 'readonly',
                document: 'readonly',
                FormData: 'readonly',
                localStorage: 'readonly',
                navigator: 'readonly',
                Notification: 'readonly',
                process: 'readonly',
                setInterval: 'readonly',
                setTimeout: 'readonly',
                clearInterval: 'readonly',
                clearTimeout: 'readonly',
                TextDecoder: 'readonly',
                TextEncoder: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                window: 'readonly',
            },
        },
        rules: {
            'no-undef': 'error',
            'no-unused-vars': 'off',
        },
    },
    {
        files: ['**/*.{test,spec}.{js,jsx}'],
        languageOptions: {
            globals: {
                beforeEach: 'readonly',
                describe: 'readonly',
                expect: 'readonly',
                it: 'readonly',
                vi: 'readonly',
            },
        },
    },
];
