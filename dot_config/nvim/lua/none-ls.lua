local null_ls = require("null-ls")
local cspell = require('cspell')

null_ls.setup({
    sources = {
        cspell.diagnostics,
        cspell.code_actions
    }
})
