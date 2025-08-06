return {
  {
    "A7Lavinraj/fyler.nvim",
    branch = "main",
    dependencies = { "echasnovski/mini.icons" },
    keys = {
      {
        "<leader>e",
        function()
          local fyler = require("fyler")
          -- fyler.open({ cwd = vim.fn.expand("%:p:h") })
          fyler.open()
        end,
        desc = "Explorer Fyler",
      },
      {
        "<leader>fe",
        function()
          local fyler = require("fyler")
          -- fyler.open({ cwd = vim.fn.expand("%:p:h") })
          fyler.open()
        end,
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
    opts = {
      views = {
        explorer = {
          default_explorer = true,
          -- win = {
          --   buf_opts = {
          --     buflisted = true,
          --   },
          -- },
        },
      },
    },
  },
}
