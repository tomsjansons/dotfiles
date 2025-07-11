return {
  {
    "epwalsh/obsidian.nvim",
    version = "*", -- recommended, use latest release instead of latest commit
    lazy = true,
    ft = "markdown",
    -- Replace the above line with this if you only want to load obsidian.nvim for markdown files in your vault:
    -- event = {
    --   -- If you want to use the home shortcut '~' here you need to call 'vim.fn.expand'.
    --   -- E.g. "BufReadPre " .. vim.fn.expand "~" .. "/my-vault/*.md"
    --   -- refer to `:h file-pattern` for more examples
    --   "BufReadPre "
    --     .. vim.fn.expand("~")
    --     .. "/obsidian/tomstoms/*.md",
    --   "BufReadPre " .. vim.fn.expand("~") .. "/obsidian/tomstoms/*.md",
    -- },
    dependencies = {
      "nvim-lua/plenary.nvim",
    },
    opts = {
      workspaces = {
        {
          name = "tomstoms",
          path = "~/obsidian/tomstoms/",
        },
      },
      completion = {
        nvim_cmp = true,
        min_chars = 2,
      },
      mappings = {

        ["<leader>o"] = {
          action = "",
          mode = { "n", "v" },
          opts = { noremap = false, expr = true, buffer = true, desc = "+Obsidian" },
        },
        ["gd"] = {
          desc = "Obsidian goto reference",
          action = function()
            return require("obsidian").util.gf_passthrough()
          end,
          opts = { noremap = false, expr = true, buffer = true },
        },
        ["<leader>oc"] = {
          desc = "Obsidian toggle [c]heckbox",
          action = function()
            return require("obsidian").util.toggle_checkbox()
          end,
          opts = { buffer = true },
        },
        ["<leader>oa"] = {
          desc = "Obsidian smart [a]ction",
          action = function()
            return require("obsidian").util.smart_action()
          end,
          opts = { buffer = true, expr = true },
        },
      },
      -- Where to put new notes. Valid options are
      --  * "current_dir" - put new notes in same directory as the current buffer.
      --  * "notes_subdir" - put new notes in the default notes subdirectory.
      new_notes_location = "notes_subdir",
    },
  },
}
