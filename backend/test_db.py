import pymongo
import os
import certifi
from dotenv import load_dotenv

load_dotenv()

uri = os.getenv("MONGO_URI")

print("Testing without certifi...")
try:
    client1 = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
    client1.admin.command('ping')
    print("Success without certifi!")
except Exception as e:
    print("Failed without certifi:", e)

print("\nTesting with certifi...")
try:
    client2 = pymongo.MongoClient(uri, tlsCAFile=certifi.where(), serverSelectionTimeoutMS=5000)
    client2.admin.command('ping')
    print("Success with certifi!")
except Exception as e:
    print("Failed with certifi:", e)
