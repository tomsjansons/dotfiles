return {
  {
    "nvim-neo-tree/neo-tree.nvim",
    keys = {
      {
        "<leader>fe",
        function()
          -- require("neo-tree.command").execute({ reveal = true, dir = LazyVim.root() })
          require("neo-tree.command").execute({ reveal = true, dir = vim.uv.cwd() })
        end,
        -- desc = "Explorer NeoTree (Root Dir)",
        desc = "Explorer NeoTree (cwd)",
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
