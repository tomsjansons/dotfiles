function is_theme_light()
	local f = io.open("/home/toms/.theme-light", "r")
	if f ~= nil then
		io.close(f)
		return true
	else
		return false
	end
end

return is_theme_light
