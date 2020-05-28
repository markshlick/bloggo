import { Theme } from 'theme-ui';

const link: NonNullable<Theme['styles']>['a'] = {
  color: 'primary',
  textDecoration: 'none',
  padding: 1,
  borderRadius: 3,
  fontWeight: 'bold',
  transition: 'all 200ms',
  '@media (hover: hover)': {
    '&:hover': {
      backgroundColor: 'pink',
    },
  },
  '&:active': {
    backgroundColor: 'pink',
  },
};

const theme: Theme = {
  space: [0, 4, 8, 16, 32, 64, 128, 256, 512],
  fonts: {
    body: '"Helvetica Neue", Arial, system-ui, sans-serif',
    heading: '"Avenir Next", system-ui, sans-serif',
    monospace: 'Menlo, monospace',
  },
  fontSizes: [12, 14, 16, 20, 24, 32, 48, 64, 96],
  fontWeights: {
    body: 400,
    heading: 700,
    bold: 700,
  },
  lineHeights: {
    body: 1.75,
    heading: 1.25,
  },
  colors: {
    text: '#000',
    background: '#fff',
    primary: '#11e',
    secondary: '#c0c',
    highlight: '#e0e',
    muted: '#f6f6ff',
    modes: {
      dark: {
        text: '#fff',
        background: '#000',
        primary: '#0fc',
        secondary: '#0cf',
        highlight: '#f0c',
        muted: '#011',
      },
    },
  },
  sizes: { container: 720 },
  links: {
    big: {
      fontSize: 4,
      ...link,
    },
  },
  styles: {
    // @ts-ignore
    waves: {
      default: {
        Wave: {
          width: ['100%', 'calc(100vw - 60px)'],
          marginTop: '40px',
          marginLeft: ['calc(50% - 50vw + 30px)'],
          marginBottom: '40px',
          position: 'relative',
          display: ['block', 'flex'],
        },
        ScrollerContainer: {
          flex: 1,
        },
        ScrollerStep: {
          position: 'relative',
          padding: [0, '0 10px'],
          minHeight: '250px',
          display: 'flex',
          alignItems: 'center',
          borderLeft: ['none', '3px solid transparent'],
        },
        ScrollerProgress: {
          position: 'absolute',
          left: ['-12px', '-3px'],
          backgroundColor: 'primary',
        },
        StickerContainer: {
          width: ['100vw', '60%'],
          position: ['sticky', 'static'],
          top: [0, 'auto'],
          zIndex: [1, 'auto'],
          height: ['50vh', 'auto'],
          marginLeft: '-16px',
        },
        Sticker: {
          position: ['static', 'sticky'],
          width: '100%',
          height: ['100%', '60vh'],
          top: ['auto', '20vh'],
          border: ['none', 'none'],
        },
        // this is used to select the active scroller step
        // 0.5 selects the step that is at half the screen height
        // 0.7 the step that is at 70% the screen height
        focus: [0.7, 0.5],
      },
    },
    root: {
      fontFamily: 'body',
      lineHeight: 'body',
      fontWeight: 'body',
    },
    h1: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 5,
    },
    h2: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 4,
    },
    h3: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 3,
    },
    h4: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 2,
    },
    h5: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 1,
    },
    h6: {
      color: 'text',
      fontFamily: 'heading',
      lineHeight: 'heading',
      fontWeight: 'heading',
      fontSize: 0,
    },
    p: {
      color: 'text',
      fontFamily: 'body',
      fontWeight: 'body',
      lineHeight: 'body',
      fontSize: 2,
    },
    a: link,
    pre: {
      fontFamily: 'monospace',
      overflowX: 'auto',
      code: {
        color: 'inherit',
      },
    },
    code: {
      fontFamily: 'monospace',
      fontSize: 'inherit',
    },
    table: {
      width: '100%',
      borderCollapse: 'separate',
      borderSpacing: 0,
    },
    th: {
      textAlign: 'left',
      borderBottomStyle: 'solid',
    },
    td: {
      textAlign: 'left',
      borderBottomStyle: 'solid',
    },
    img: {
      maxWidth: '100%',
    },
  },
};

export default theme;
