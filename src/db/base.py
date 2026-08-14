from sqlalchemy.orm import declarative_base

Base = declarative_base()

# 👇 Import all models here so metadata is aware of them
# from db.modules.users import models  # noqa