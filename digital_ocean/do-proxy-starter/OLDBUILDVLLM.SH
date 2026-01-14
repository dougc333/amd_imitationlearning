# wait_for_apt() {
#   echo "Checking for apt/dpkg lock..."
#   # Wait while lock files are held
#   while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || \
#         fuser /var/lib/apt/lists/lock >/dev/null 2>&1 || \
#         fuser /var/cache/apt/archives/lock >/dev/null 2>&1; do
#     echo "apt/dpkg is locked by another process. Waiting 5s..."
#     sleep 5
#   done
# }

# pause_apt_services() {
#   echo "Pausing background apt services/timers..."
#   # Stop services *now*
#   sudo systemctl stop apt-daily.service apt-daily-upgrade.service unattended-upgrades.service || true

#   # Stop the timers so they don’t restart
#   sudo systemctl stop apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true

#   # Optionally disable them so they don't come back after reboot
#   sudo systemctl disable apt-daily.service apt-daily-upgrade.service unattended-upgrades.service || true
#   sudo systemctl disable apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true
# }

# resume_apt_services() {
#   echo "Resuming background apt services/timers..."
#   # Re-enable and start everything again
#   sudo systemctl enable apt-daily.service apt-daily-upgrade.service unattended-upgrades.service 2>/dev/null || true
#   sudo systemctl enable apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true

#   sudo systemctl start apt-daily.service apt-daily-upgrade.service unattended-upgrades.service 2>/dev/null || true
#   sudo systemctl start apt-daily.timer apt-daily-upgrade.timer 2>/dev/null || true
# }

# apt_install_with_retry() {
#   local attempts=12   # total retries
#   local delay=10      # seconds between retries
#   local pkgs=("$@")
#   local rc=0

#   # Pause apt-related services/timers around the whole install sequence
#   pause_apt_services

#   local attempt
#   for ((attempt=1; attempt<=attempts; attempt++)); do
#     wait_for_apt

#     echo "Attempt $attempt/$attempts: Installing: ${pkgs[*]}"
#     if sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}"; then
#       echo "apt-get install succeeded."
#       rc=0
#       break
#     else
#       rc=$?
#       if [ "$rc" -eq 100 ]; then
#         echo "apt-get failed with exit code 100 (lock likely in use). Sleeping ${delay}s then retrying..."
#         sleep "$delay"
#       else
#         echo "apt-get failed with non-lock exit code $rc. Aborting."
#         break
#       fi
#     fi
#   done

#   if [ "$rc" -eq 100 ] && [ "$attempt" -gt "$attempts" ]; then
#     echo "apt-get still failing with lock after $attempts attempts. Giving up."
#   fi

#   # Always try to resume services, even if install failed
#   resume_apt_services

#   return "$rc"
# }

# ensure_packages() {
#   local missing=()

#   for pkg in "$@"; do
#     if ! dpkg -s "$pkg" >/dev/null 2>&1; then
#       missing+=("$pkg")
#     fi
#   done

#   if [ "${#missing[@]}" -gt 0 ]; then
#     echo "Need to install packages: ${missing[*]}"
#     apt_install_with_retry "${missing[@]}"
#   else
#     echo "Required packages already installed, skipping apt-get install."
#   fi
# }

# ------------------ vLLM build steps ------------------
