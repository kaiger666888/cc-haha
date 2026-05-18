import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

describe('release desktop workflow', () => {
  test('build job runs directly without quality preflight dependency', () => {
    const workflow = readFileSync('.github/workflows/release-desktop.yml', 'utf8')

    expect(workflow).not.toContain('quality-preflight:')
    expect(workflow).not.toContain('run: bun run quality:gate --mode pr')
    expect(workflow).not.toContain('needs: quality-preflight')
    expect(workflow).toContain('name: Build (${{ matrix.label }})')
  })

  test('desktop build workflows keep Bun compile cache on the runner work drive', () => {
    for (const workflowPath of [
      '.github/workflows/build-desktop-dev.yml',
      '.github/workflows/release-desktop.yml',
    ]) {
      const workflow = readFileSync(workflowPath, 'utf8')
      const buildSidecarsStep = workflow.match(
        /- name: Build sidecars[\s\S]*?run: bun run build:sidecars/,
      )?.[0]

      expect(buildSidecarsStep, workflowPath).toContain(
        'BUN_INSTALL_CACHE_DIR: ${{ runner.temp }}/bun-install-cache',
      )
      expect(buildSidecarsStep, workflowPath).toContain(
        'TAURI_ENV_TARGET_TRIPLE: ${{ matrix.rust_target }}',
      )
    }
  })
})
