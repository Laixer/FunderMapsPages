module.exports = {
  // content: ['./index.php', './app/**/*.php', './resources/**/*.{php,vue,js}'],
  content: [
    './src/**/*.{html,js,ts,jsx,tsx}',
    './src/resources/styles/**/*.scss',
  ],
  theme: {
    colors: {
      inherit: 'inherit',
      transparent: 'transparent',
      current: 'currentColor',
      white: 'white',
      black: 'black',
      grey: {
        100: '#F6F7F8',
        200: '#E8EAF1',
        300: '#CED0DA',
        400: '#7F8FA4',
        900: '#17192a',
      },
      yellow: {
        100: '#FFFAF0',
        300: '#FFCC69',
      },
      green: {
        100: '#E9FAF3',
        300: '#28CC8B',
      },
      red: {
        500: '#dc3545',
      },
      blue: {
        100: '#E7F6FD',
        300: '#17A4EA',
        400: '#3D5372',
        900: '#191E3C',
      },
    },
    fontFamily: {
      sans: ['Greycliff CF', 'sans-serif'],
      mono: [
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Monaco',
        'Consolas',
        'Liberation Mono',
        'Courier New',
        'monospace',
      ],
    },
    fontSize: {
      '4xl': ['clamp(2.5rem, 2.1479rem + 1.5023vw, 3.5rem)', {// 56px
        lineHeight: '2.75rem',
        letterSpacing: '-0.4px',
      }],
      '3xl': ['clamp(2.25rem, 2.0299rem + 0.939vw, 2.875rem)', {// 46px
        lineHeight: '2.75rem',
        letterSpacing: '-1px',
      }],
      '2xl': ['clamp(1.875rem, 1.743rem + 0.5634vw, 2.25rem)', { // 36px
        letterSpacing: '-1px',
      }],
      xl: ['clamp(1.125rem, 1.081rem + 0.1878vw, 1.25rem)', { // 20px
        letterSpacing: '-1px',
      }],
      lg: ['1.125rem', { // 18px
        lineHeight: '1.625rem',
      }],
      base: ['1rem', { // 16px
        lineHeight: '1.5rem',
      }],
      sm: ['0.875rem', { // 14px
        lineHeight: '1.5rem',
      }],
    },
    extend: {
      aspectRatio: {
        '3/2': '3 / 2',
      },
      boxShadow: {
        'button': '0 10px 20px 0 rgba(0,0,0,0.15)',
        'hero-img': '0 12px 24px 0 rgba(0,0,0,0.10)',
        'hero-img-overlay-1': '0 14px 29px 0 rgba(0,0,0,0.10)',
        'hero-img-overlay-2': '0 17px 35px 0 rgba(0,0,0,0.10)',
        'quote': '0 20px 40px 0 rgba(0,0,0,0.20)',
        'slider-arrow': '0 0 20px 0 rgba(0,0,0,0.20)',
      },
      gridTemplateColumns: {
        cards: 'repeat(auto-fill, minmax(18em, 1fr))',
      },
      outlineWidth: {
        usp: '1.75rem',
      }
    },
  },
  safelist: [
    'text-white',
    'lg:pr-6',
    {
      pattern: /bg-(red|green|blue|yellow|grey|black|white)-(100|200|300|300|400|500|600|700|800|900)/,
    },
    {
      pattern: /button-(primary|secondary)/,
    }
  ],
};
