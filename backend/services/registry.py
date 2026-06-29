from ..ws_manager import ConnectionManager
from .auction import AuctionService

manager = ConnectionManager()
auction_service = AuctionService(manager)
