local get_nix_cmd = function(ls_name_in_store, exec_name, path)
  path = path or "/bin/"
  local handle = io.popen(
    "cd /nix/store && ls -la | grep '4096' | grep '" ..
    ls_name_in_store .. "' | grep -v 'unwrapped' | grep -v 'fish' | awk '{print $9}'"
  )
  local found_stores_result = handle:read("*a")
  handle:close()
  local nix_store = ""
  for line in found_stores_result:gmatch("[^\r\n]+") do
    local line_name = line:match("%-(.*)") or line
    local store_name = nix_stores and nix_store:match("%-(.*)") or nix_store or nix_store

    if line_name > store_name then
      nix_store = line
    end
  end
  local location = "/nix/store/" .. nix_store:gsub("[\n\r]", "") .. path .. exec_name
  return location
end

return get_nix_cmd
