-- vim.pack.add({ { src = "https://github.com/nvim-mini/mini.completion" } })
--
-- require("mini.completion").setup({
-- 	window = {
-- 		info = { height = 25, width = 80, border = "single" },
-- 		signature = { height = 25, width = 80, border = "single" },
-- 	},
-- })
vim.pack.add({ { src = "https://github.com/Saghen/blink.cmp" } })

local function build_blink(params)
	vim.notify("Building blink", vim.log.levels.INFO)
	local obj = vim.system({ "cargo", "build", "--release" }, { cwd = params.path }):wait()
	if obj.code == 0 then
		vim.notify("Building blink done", vim.log.levels.INFO)
	else
		vim.notify("Building blink failed", vim.log.levels.ERROR)
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
	keymap = { preset = "enter" },
	signature = {
		enabled = true,
	},
	appearance = {
		nerd_font_variant = "mono",
	},
	completion = { documentation = { auto_show = true } },
	fuzzy = { implementation = "prefer_rust_with_warning" },
})
