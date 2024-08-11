vim.keymap.set('n', '<leader>dl', vim.diagnostic.setloclist, { desc = '[D]iagnostics [L]ist' })

vim.keymap.set('n', '<Leader>df', vim.diagnostic.open_float,
  { noremap = true, silent = true, desc = '[D]iagnostics [F]loat window' })
vim.keymap.set('n', '<Leader>dn', vim.diagnostic.goto_next,
  { noremap = true, silent = true, desc = '[D]iagnostics [N]ext' })
vim.keymap.set('n', '<Leader>dp', vim.diagnostic.goto_prev,
  { noremap = true, silent = true, desc = '[D]iagnostics [P]rev' })
