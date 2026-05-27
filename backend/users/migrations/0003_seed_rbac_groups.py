from django.db import migrations


GROUPS = ["Household User", "Service Account", "Administrator"]


def seed_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    for name in GROUPS:
        Group.objects.get_or_create(name=name)


def unseed_groups(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.filter(name__in=GROUPS).delete()


class Migration(migrations.Migration):
    """
    Seeds the three Django Groups corresponding to the RBAC roles described in
    paper §VI.F.2. Permission classes in users/permissions.py check group
    membership; this migration ensures the groups exist on every deployment.
    """

    dependencies = [
        ("users", "0002_profile_meralco_account_number"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.RunPython(seed_groups, reverse_code=unseed_groups),
    ]
