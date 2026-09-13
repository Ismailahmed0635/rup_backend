import sys
import os
sys.path.insert(0, '/rup/payment_gateway')
sys.path.insert(0, '/rup/payment_gateway/api')

# Import the config first to set up the package
from core.config import settings

# Now import the router
from api.v1.payment import router
print('Router loaded successfully')
print('Routes:')
for route in router.routes:
    if hasattr(route, 'methods') and hasattr(route, 'path'):
        print(f"  {route.methods} {route.path}")