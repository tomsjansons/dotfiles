return {
  {
    "nvim-telescope/telescope.nvim",
    keys = {
      {
        "<leader>ff",
        function()
          require("fff").find_files()
        end,
        desc = "Open file picker",
      },
      {
        "<leader>F",
        function()
          require("fff").find_in_git_root()
        end,
        desc = "Open file picker",
      },
    },
  },
}
