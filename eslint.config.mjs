// @nuxt/eslint generates a project-aware flat config in .nuxt during prepare.
import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  // Turn off ESLint rules that conflict with Prettier formatting.
  prettier,
)
