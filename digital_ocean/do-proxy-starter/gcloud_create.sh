gcloud compute instances create instance-20251202-194908 \
    --project=seraphic-plexus-328620 \
    --zone=us-central1-f \
    --machine-type=n1-standard-4 \
    --network-interface=network-tier=PREMIUM,stack-type=IPV4_ONLY,subnet=default \
    --metadata=enable-osconfig=TRUE \
    --maintenance-policy=TERMINATE \
    --provisioning-model=STANDARD \
    --service-account=428120510823-compute@developer.gserviceaccount.com \
    --scopes=https://www.googleapis.com/auth/devstorage.read_only,https://www.googleapis.com/auth/logging.write,https://www.googleapis.com/auth/monitoring.write,https://www.googleapis.com/auth/service.management.readonly,https://www.googleapis.com/auth/servicecontrol,https://www.googleapis.com/auth/trace.append \
    --accelerator=count=1,type=nvidia-tesla-t4 \
    --create-disk=auto-delete=yes,boot=yes,device-name=instance-20251202-194908,image=projects/debian-cloud/global/images/debian-12-bookworm-v20251111,mode=rw,size=10,type=pd-balanced \
    --no-shielded-secure-boot \
    --shielded-vtpm \
    --shielded-integrity-monitoring \
    --labels=goog-ops-agent-policy=v2-x86-template-1-4-0,goog-ec-src=vm_add-gcloud \
    --reservation-affinity=any \
&& \
printf 'agentsRule:\n  packageState: installed\n  version: latest\ninstanceFilter:\n  inclusionLabels:\n  - labels:\n      goog-ops-agent-policy: v2-x86-template-1-4-0\n' > config.yaml \
&& \
gcloud compute instances ops-agents policies create goog-ops-agent-v2-x86-template-1-4-0-us-central1-f \
    --project=seraphic-plexus-328620 \
    --zone=us-central1-f \
    --file=config.yaml \
&& \
gcloud compute resource-policies create snapshot-schedule default-schedule-1 \
    --project=seraphic-plexus-328620 \
    --region=us-central1 \
    --max-retention-days=14 \
    --on-source-disk-delete=keep-auto-snapshots \
    --daily-schedule \
    --start-time=17:00 \
&& \
gcloud compute disks add-resource-policies instance-20251202-194908 \
    --project=seraphic-plexus-328620 \
    --zone=us-central1-f \
    --resource-policies=projects/seraphic-plexus-328620/regions/us-central1/resourcePolicies/default-schedule-1
