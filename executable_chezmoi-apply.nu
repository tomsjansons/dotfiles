if 'BW_SESSION' not-in $env {
	{BW_SESSION:(bw unlock --raw)} | load-env
}
chezmoi apply
