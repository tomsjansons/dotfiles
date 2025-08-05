return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    enabled = false,
    keys = {
      {
        "<leader>fe",
        function()
          require("neo-tree.command").execute({ reveal = true, dir = LazyVim.root() })
        end,
        desc = "Explorer NeoTree (Root Dir)",
      },
      {
        "<leader>fE",
        function()
          require("neo-tree.command").execute({ reveal = true, dir = vim.uv.cwd() })
        end,
        desc = "Explorer NeoTree (cwd)",
      },
      {
        "<leader>B",
        function()
          require("neo-tree.command").execute({ source = "buffers", toggle = true })
        end,
        desc = "Buffer Explorer",
      },
    },
    opts = {
      window = {
        position = "float",
      },
    },
  },
}
