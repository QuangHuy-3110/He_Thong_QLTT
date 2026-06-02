# -*- coding: utf-8 -*-
import os
import sys
import django

sys.path.append('.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kms_core.settings')
django.setup()

from app.models import LessonPlan

print("Starting target_student standardization...")
count = 0
for l in LessonPlan.objects.all():
    ts = l.target_student
    if ts:
        new_ts = ts.replace("HS thành thị", "Học sinh thành thị").replace("HS nông thôn", "Học sinh nông thôn")
        if l.target_student != new_ts:
            l.target_student = new_ts
            l.save(update_fields=['target_student'])
            count += 1

print(f"Success! Standardized {count} records.")
