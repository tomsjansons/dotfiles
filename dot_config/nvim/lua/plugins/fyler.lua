return {
  {
    "A7Lavinraj/fyler.nvim",
    dependencies = { "echasnovski/mini.icons" },
    keys = {
      {
        "<leader>e",
        "<cmd>Fyler.nvim<cr>",
        desc = "Explorer Fyler",
      },
      {
        "<leader>fe",
        "<cmd>Fyler.nvim<cr>",
        desc = "Explorer Fyler",
      },
      -- {
      --   "<leader>fE",
      --   function()
      --     require("neo-tree.command").execute({ reveal = true, dir = vim.uv.cwd() })
      --   end,
      --   desc = "Explorer Fyler (cwd)",
      -- },
      -- {
      --   "<leader>B",
      --   function()
      --     require("neo-tree.command").execute({ source = "buffers", toggle = true })
      --   end,
      --   desc = "Buffer Explorer",
      -- },
    },
    opts = {},
  },
}
