# Migrating to Pure iptables (Disabling nftables)

## Problem

Your system has both iptables and nftables hooks active. Docker uses iptables extensively, but nftables' forward chain with `policy drop` blocks container traffic before iptables rules can evaluate it.

## Current State

- **iptables**: Extensive Docker + Tailscale rules (auto-managed)
- **nftables**: Simple host firewall (input chain with drop policy), forward chain with drop policy

## Migration Steps

### 1. Record current nftables input rules (for migration)

```bash
# View what needs to be migrated
sudo nft list table inet filter
```

Your current rules allow:
- Established/related connections
- Loopback interface
- ICMP (IPv4 and IPv6)
- SSH from 100.100.186.245

### 2. Flush nftables rules

```bash
# Remove all nftables rules from kernel
sudo nft flush ruleset
```

### 3. Disable nftables service

```bash
# Stop and disable the service
sudo systemctl stop nftables
sudo systemctl disable nftables
```

### 4. Create iptables rules directory

```bash
# Create directory for iptables rules if it doesn't exist
sudo mkdir -p /etc/iptables
```

### 5. Add host firewall rules to iptables

```bash
# Set default policies (allow outbound, drop inbound not explicitly allowed)
sudo iptables -P INPUT DROP
sudo iptables -P FORWARD DROP
sudo iptables -P OUTPUT ACCEPT

# Allow established and related connections
sudo iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
sudo iptables -A INPUT -i lo -j ACCEPT

# Allow ICMP (ping, etc.)
sudo iptables -A INPUT -p icmp -j ACCEPT
sudo iptables -A INPUT -p ipv6-icmp -j ACCEPT

# Allow SSH from specific IP
sudo iptables -A INPUT -s 100.100.186.245 -p tcp --dport 22 -j ACCEPT

# (Optional) Allow SSH from localhost for debugging
# sudo iptables -A INPUT -s 127.0.0.1 -p tcp --dport 22 -j ACCEPT
```

### 6. Save iptables rules permanently

```bash
# Save current rules to file
sudo iptables-save | sudo tee /etc/iptables/iptables.rules

# For IPv6 (if needed)
sudo ip6tables-save | sudo tee /etc/iptables/ip6tables.rules
```

### 7. Enable iptables service (Arch Linux)

```bash
# Enable iptables to load rules on boot
sudo systemctl enable iptables

# If you have ip6tables rules
sudo systemctl enable ip6tables

# Start the service now
sudo systemctl start iptables
```

### 8. Verify

```bash
# Check iptables rules are loaded
sudo iptables -L -n

# Test Docker networking works
docker run --rm oven/bun:1-debian sh -c "bun add lodash && echo SUCCESS"

# Check nftables is empty
sudo nft list ruleset
# Should output nothing or "table inet filter" with empty chains
```

### 9. Rebuild the sandbox image

```bash
# Now that Docker networking works, rebuild
cd /path/to/adv-lead-o-matic-2/packages/pi-agent/sandbox
docker build -t pi-sandbox:latest .
```

## Rollback (if needed)

```bash
# Re-enable nftables
sudo systemctl enable nftables
sudo systemctl start nftables

# Restore iptables to Docker defaults (restart Docker)
sudo systemctl restart docker

# Or manually load nftables config
sudo nft -f /etc/nftables.conf
```

## Notes

- Docker automatically recreates its iptables rules when it starts
- Tailscale also manages its own iptables rules
- After migration, Docker will work without interference from nftables
- Your host firewall (input rules) is now managed by iptables

## Verification Checklist

- [ ] `sudo nft list ruleset` shows empty or minimal output
- [ ] `sudo iptables -L INPUT -n` shows your firewall rules
- [ ] `docker run --rm alpine ping -c 2 8.8.8.8` works
- [ ] `docker run --rm oven/bun:1-debian bun add lodash` works
- [ ] `sudo systemctl status iptables` shows active
- [ ] `sudo systemctl status nftables` shows disabled/inactive
