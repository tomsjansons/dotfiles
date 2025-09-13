local nvim_lsp = require("lspconfig")

vim.filetype.add({
  pattern = {
    [".*/.jinja-*"] = "jinja",
  },
})

return {
  {
    "neovim/nvim-lspconfig",
    opts = {
      inlay_hints = { enabled = false },
      servers = {
        jinja_lsp = {
          filetypes = { "jinja", "html" },
        },
        eslint = {},
        denols = {
          filetypes = { "typescript", "typescriptreact" },
          root_dir = function(...)
            return nvim_lsp.util.root_pattern("deno.jsonc", "deno.json")(...)
          end,
        },
        vtsls = {
          root_dir = nvim_lsp.util.root_pattern("package.json"),
        },
        biome = {
          root_dir = nvim_lsp.util.root_pattern("biome.json", "biome.jsonc"),
        },
      },
      setup = {
        eslint = function()
          require("lazyvim.util").lsp.on_attach(function(client)
            if client.name == "eslint" then
              client.server_capabilities.documentFormattingProvider = true
            elseif client.name == "tsserver" then
              client.server_capabilities.documentFormattingProvider = false
            end
          end)
        end,
      },
    },
  },
}
