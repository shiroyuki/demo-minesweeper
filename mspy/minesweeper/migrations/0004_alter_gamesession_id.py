# Generated by Django 4.2.16 on 2024-09-10 03:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('minesweeper', '0003_alter_gamesession_id_alter_gamesession_state'),
    ]

    operations = [
        migrations.AlterField(
            model_name='gamesession',
            name='id',
            field=models.CharField(default='a01a3b90-23da-4a60-a432-3a29bb8c2eca', primary_key=True, serialize=False),
        ),
    ]
