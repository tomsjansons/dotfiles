local format_on_save = require("format-on-save")
local formatters = require("format-on-save.formatters")

local js_related = {
	formatters.if_file_exists({
		pattern = "*eslint*",
		formatter = formatters.eslint_d_fix,
	}),
	formatters.if_file_exists({
		pattern = { "*prettier*" },
		formatter = formatters.prettierd,
	}),
	formatters.if_file_exists({
		pattern = { "*biome*" },
		-- formatter = formatters.shell({ cmd = { "biome", "lint", "--write", vim.api.nvim_buf_get_name(0) } }),
		formatter = formatters.shell({
			tempfile = "random",
			-- tempfile = function()
			-- 	print("biome formatting temp file: " .. vim.fn.expand("%"))
			-- 	return vim.fn.expand("%") .. '.formatter-temp'
			-- end,
			cmd = { "biome", "lint", "--write", "--unsafe", "%" }
			-- cmd = function()
			-- 	print("biome lint --write " .. vim.fn.expand("%"))
			-- 	return { "biome", "lint", "--write", "%" }
			-- end
		}),
	}),
	formatters.if_file_exists({
		pattern = { "*biome*" },
		formatter = formatters.lsp,
	}),
	formatters.if_file_exists({
		pattern = { "*deno*" },
		formatter = formatters.lsp
	})
}

format_on_save.setup({
	exclude_path_patterns = {
		"/node_modules/",
		".local/share/nvim/lazy",
	},
	formatter_by_ft = {
		graphql = {
			formatters.prettierd,
		},
		astro = {
			formatters.eslint_d_fix,
			formatters.prettierd,
		},
		svelte = {
			formatters.eslint_d_fix,
			formatters.lsp
		},
		css = formatters.lsp,
		html = formatters.lsp,
		java = formatters.lsp,
		javascript = js_related,
		json = formatters.lsp,
		jsonc = formatters.lsp,
		lua = formatters.lsp,
		markdown = formatters.prettierd,
		openscad = formatters.lsp,
		python = formatters.black,
		rust = formatters.lsp,
		scad = formatters.lsp,
		scss = formatters.lsp,
		sh = formatters.shfmt,
		terraform = formatters.lsp,
		typescript = js_related,
		typescriptreact = js_related,
		yaml = formatters.lsp,
	}
})
