import '@fontsource-variable/inter'
import '../src/styles/index.css'
import './preview.css'

import { withThemeByDataAttribute } from '@storybook/addon-themes'
import type { Decorator, Preview } from '@storybook/react-vite'

import { TooltipProvider } from '../src/components/tooltip/Tooltip'

// Tooltips share one timer, so moving between buttons shows the next one straight away.
const withTooltips: Decorator = (Story) => (
  <TooltipProvider>
    <Story />
  </TooltipProvider>
)

const preview: Preview = {
  decorators: [
    withTooltips,
    // Adds a light/dark switch (paintbrush icon) to the Storybook toolbar.
    withThemeByDataAttribute({
      themes: { Light: 'light', Dark: 'dark' },
      defaultTheme: 'Light',
      attributeName: 'data-theme',
    }),
  ],
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: {
        order: ['Start here', 'Components', ['Button', 'Icon button', 'Text field', 'Search field', 'Tooltip', 'Slider', 'Toggle', 'Select', 'Skeleton', 'Menu', 'Popover', 'Dialog', 'Toast', 'Account', 'Tabs', 'Panel', 'Toolbar'], 'Editor sample', 'Tokens'],
      },
    },
  },
}

export default preview
