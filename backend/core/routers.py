class ParallelSchemaRouter:
    """
    A router to control all database operations on models in the
    'billing' and 'analytics' applications to route them to a parallel database/schema.
    """
    # Define which apps should be routed
    route_app_labels = {'billing', 'analytics'}
    # Define the name of the parallel database connection set in DATABASES
    target_db = 'parallel_schema'

    def db_for_read(self, model, **hints):
        """Direct read operations for routed apps to the target database."""
        if model._meta.app_label in self.route_app_labels:
            return self.target_db
        return None

    def db_for_write(self, model, **hints):
        """Direct write operations for routed apps to the target database."""
        if model._meta.app_label in self.route_app_labels:
            return self.target_db
        return None

    def allow_relation(self, obj1, obj2, **hints):
        """Allow relations if a model in the routed apps is involved."""
        if (
            obj1._meta.app_label in self.route_app_labels or
            obj2._meta.app_label in self.route_app_labels
        ):
            return True
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        """Ensure that routed apps only appear in the target database."""
        if app_label in self.route_app_labels:
            return db == self.target_db
        return None
