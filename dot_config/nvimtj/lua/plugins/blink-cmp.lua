vim.pack.add({
	{ src = "https://github.com/Saghen/blink.cmp" },
})

local function build_blink(params)
	vim.notify("Building blink.cmp", vim.log.levels.INFO)
	local obj = vim.system({ "cargo", "build", "--release" }, { cwd = params.path }):wait()
	if obj.code == 0 then
		vim.notify("Building blink.cmp done", vim.log.levels.INFO)
	else
		vim.notify("Building blink.cmp failed", vim.log.levels.ERROR)
	end
end

vim.api.nvim_create_autocmd("PackChanged", {
	pattern = "*",
	callback = function(ev)
		vim.notify(ev.data.spec.name .. " has been updated.")
		if ev.data.spec.name == "blink.cmp" then
			build_blink({ path = ev.data.path })
		end
	end,
})

require("blink.cmp").setup({
	signature = { enabled = true },
	keymap = {
		preset = "enter",
	},
	completion = {
		documentation = { auto_show = true, auto_show_delay_ms = 500 },
		menu = {
			auto_show = true,
			draw = {
				treesitter = { "lsp" },
				columns = { { "kind_icon", "label", "label_description", gap = 1 }, { "kind" } },
			},
		},
	},
})
