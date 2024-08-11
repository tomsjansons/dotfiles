require("mason-nvim-dap").setup({
  ensure_installed = { 'codelldb', 'cpptools' }
})

local dap = require('dap')
local get_nix_cmd = require("nix-cmd")
local codelldb = get_nix_cmd("vscode-extension.vadimcn.vscode-lldb", "codelldb",
  "/share/vscode/extensions/vadimcn.vscode-lldb/adapter/")

dap.adapters.codelldb = {
  type = 'server',
  port = '${port}',
  executable = {
    command = codelldb,
    args = { '--port', '${port}' },
  },
}
dap.configurations.rust = {
  {
    name = 'Debug with codelldb',
    type = 'codelldb',
    request = 'launch',
    -- program =
    -- "cat map-data/map-data-riga-cesis.json | /home/toms/dev/moto-router/target/debug/moto-router --from_lat 57.1542058021927 --from_lon 24.853520393371586 --to_lat 57.31337 --to_lon 25.28080",
    program = function()
      return vim.fn.input({
        prompt = 'Path to executable: ',
        default = vim.fn.getcwd() .. '/target/debug/',
        completion = 'file',
      })
    end,
    cwd = '${workspaceFolder}',
    stopOnEntry = false,
    args = {
      "--data_file",
      "map-data/map-data-riga-cesis.json",
      "--from_lat",
      "57.1542058021927",
      "--from_lon",
      "24.853520393371586",
      "--to_lat",
      "57.31337",
      "--to_lon",
      "25.28080"
    }
  },
}

require("dapui").setup()

local dapui = require("dapui")
dap.listeners.before.attach.dapui_config = function()
  dapui.open()
end
dap.listeners.before.launch.dapui_config = function()
  dapui.open()
end
dap.listeners.before.event_terminated.dapui_config = function()
  dapui.close()
end
dap.listeners.before.event_exited.dapui_config = function()
  dapui.close()
end

vim.keymap.set('n', '<F5>', function() require('dap').continue() end, { desc = "Continue" })
vim.keymap.set('n', '<F10>', function() require('dap').step_over() end, { desc = "Stop Over" })
vim.keymap.set('n', '<F11>', function() require('dap').step_into() end, { desc = "Step Into" })
vim.keymap.set('n', '<F12>', function() require('dap').step_out() end, { desc = "Setp Out" })
vim.keymap.set('n', '<Leader>bt', function() require('dap').toggle_breakpoint() end, { desc = "Breakpoint [T]oggle" })
vim.keymap.set('n', '<Leader>bs', function() require('dap').set_breakpoint() end, { desc = "Breakpoint [S]et" })
vim.keymap.set('n', '<Leader>bl',
  function() require('dap').set_breakpoint(nil, nil, vim.fn.input('Log point message: ')) end,
  { desc = "Breakpoint Set [L]og" })
vim.keymap.set('n', '<Leader>br', function() require('dap').repl.open() end, { desc = "Open [R]epl" })
vim.keymap.set('n', '<Leader>bl', function() require('dap').run_last() end, { desc = "Run [L]ast" })
vim.keymap.set({ 'n', 'v' }, '<Leader>bh', function()
  require('dap.ui.widgets').hover()
end, { desc = "[H]over" })
vim.keymap.set({ 'n', 'v' }, '<Leader>bp', function()
  require('dap.ui.widgets').preview()
end, { desc = "Widget [P]review" })
vim.keymap.set('n', '<Leader>bf', function()
  local widgets = require('dap.ui.widgets')
  widgets.centered_float(widgets.frames)
end, { desc = "Widget [F]rames" })
vim.keymap.set('n', '<Leader>bS', function()
  local widgets = require('dap.ui.widgets')
  widgets.centered_float(widgets.scopes)
end, { desc = "Widget [S]copes" })
