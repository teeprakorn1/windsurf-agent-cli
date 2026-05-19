# /network

> Network architecture, routing, switching, firewall design, VPN, and load balancing. Used for designing LAN/WAN topologies, configuring network devices, or troubleshooting connectivity.

---

## ⚠️ CURSOR OUTPUT CONTRACT

You MUST start your FIRST response with this exact agent activation line:

```
🤖 **Active Agent: `network-engineer`** | Skills: `clean-code, bash-linux, server-management, architecture`
```

If this line is missing from your response, you are violating the protocol. Add it before any other content.

## Required Behavior

1. Read the agent's full instructions from `.windsurf/agents/network-engineer.md` (or `.cursor/rules/agents/network-engineer.mdc`)
2. Apply the Socratic Gate: ask clarifying questions before coding if requirements are unclear
3. Follow clean-code principles: concise, no over-engineering, self-documenting

---

# /network — Network Engineering

$ARGUMENTS

---


## 🤖 Agent Activation

> **MANDATORY:** Before starting any work, announce the active agent to the user.

```
🤖 **Active Agent: `network-engineer`** | Skills: `clean-code, bash-linux, server-management, architecture`
```

## Task

Design, configure, and troubleshoot network infrastructure.

### Steps:

1. **Topology Design**
   - Physical layout (cabling, devices)
   - Logical layout (VLANs, subnets, routing)
   - Redundancy and failover

2. **IP Addressing**
   - Subnet planning (CIDR)
   - DHCP scopes
   - DNS resolution

3. **Routing**
   - Protocol selection (OSPF, BGP, static)
   - Route summarization
   - Path redundancy

4. **Security**
   - Firewall rules (ACL, zone-based)
   - VPN (site-to-site, remote access)
   - Network segmentation

5. **Load Balancing**
   - L4 vs L7
   - Algorithm selection
   - Health checks

---

## Usage Examples

```
/network design office LAN with VLANs
/network configure BGP between two sites
/network setup WireGuard VPN
/network design firewall rules for DMZ
/network configure Nginx load balancer
/network troubleshoot packet loss
/network design SD-WAN for branches
```
