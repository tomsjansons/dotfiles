vim.pack.add({
	{ src = "https://github.com/nvim-neotest/nvim-nio" },
	{ src = "https://github.com/mfussenegger/nvim-dap" },
	{ src = "https://github.com/rcarriga/nvim-dap-ui" },
	{ src = "https://github.com/leoluz/nvim-dap-go" },
})

local dap = require("dap")

-- configure codelldb adapter
dap.adapters.codelldb = {
	type = "server",
	port = "${port}",
	executable = {
		command = "codelldb",
		args = { "--port", "${port}" },
	},
}

-- setup a debugger config for zig projects
dap.configurations.zig = {
	{
		name = "Launch",
		type = "codelldb",
		request = "launch",
		-- program = "${workspaceFolder}/zig-out/bin/${workspaceFolderBasename}",
		program = "${workspaceFolder}/zig-out/bin/main",
		cwd = "${workspaceFolder}",
		stopOnEntry = false,
		args = {},
	},
}

vim.keymap.set("n", "<leader>db", function()
	require("dap").toggle_breakpoint()
end, { desc = "DAP Toggle Breakpoint" })

vim.keymap.set("n", "<leader>dr", function()
	require("dap").continue()
end, { desc = "DAP Run" })

vim.keymap.set("n", "<leader>d", "", { desc = "DAP" })

vim.keymap.set("n", "<leader>du", function()
	require("dapui").toggle()
end, { desc = "DAP UI Toggle" })

vim.keymap.set("n", "m", function()
	require("dap").step_over()
end, { desc = "DAP Step Over" })

vim.keymap.set("n", "<S-m>", function()
	require("dap").step_into()
end, { desc = "DAP Step Into" })

vim.keymap.set("n", "<C-m>", function()
	require("dap").step_out()
end, { desc = "DAP Step Out" })

require("dap-go").setup()
