from Naked.toolshed.shell import execute_js, muterun_js
import json, hmac, hashlib, time, requests, base64, pandas, urllib
import datetime
import math
import numpy as np
from prettytable import PrettyTable

def getCoinmarketcapData(id):

  ret = requests.get("https://api.coinmarketcap.com/data-api/v3/cryptocurrency/historical?id=" + str(id) + "&convertId=2781&timeStart=1199175151&timeEnd=" + str(int(datetime.datetime.today().timestamp())) + "&interval=hourly")

  coindata = [data['quote'] for data in ret.json()["data"]["quotes"]]

  name = [ret.json()["data"]['name']] * len(coindata)

  id = [ret.json()["data"]['id']] * len(coindata)

  [coindata[i].update({"id": id[i], "name": name[i]}) for i in range(0, len(coindata))]

  df = pandas.DataFrame(coindata).loc[:, ["timestamp", "name", "id", "volume", "marketCap", "close"]]

  df["one_day_growth"] = (df["close"]/df.shift(1)["close"]) - 1

  df["one_week_rolling_growth"] = (df["close"]/df.shift(7)["close"]) - 1

  df['timestamp'] = pandas.to_datetime(df['timestamp'])

  df['timestamp'] = df['timestamp'].dt.tz_localize(None)

  df['monthly_growth'] = df['close'].pct_change(30)

  df['previous_day_volume'] = df['volume'].shift(1)

  df['previous_day_marketCap'] = df['marketCap'].shift(1)

  df['previous_day_close'] = df['close'].shift(1)

  binned, bins = pandas.cut(df['one_day_growth'], 3, labels=[1,2,3], retbins=True)
  df['one_day_growth_bins'] = binned

  weekbinned, weekbins = pandas.cut(df['one_week_rolling_growth'], 3, labels=[1,2,3], retbins=True)
  df['week_growth_bins'] = weekbinned

  monthbinned, monthbins = pandas.cut(df['monthly_growth'], 3, labels=[1,2,3], retbins=True)
  df['month_growth_bins'] = monthbinned

  return df.dropna().reset_index(drop=True)

action = []
current = None
returns = []
purchase_date = None
actionTable = PrettyTable()
actionTable.field_names = ["Date", "Action", "Price", "Notes"]
returnTable = PrettyTable()
returnTable.field_names = ["Date", "Return"]
while True:

    print("Running while loop")

    df = getCoinmarketcapData(9443).dropna().reset_index(drop=True)
    start = datetime.datetime.strptime("2021-11-01", "%Y-%m-%d")
    
    if purchase_date != None:
        if df["timestamp"][len(df) - 1] > (purchase_date + datetime.timedelta(days=1)):
            success = execute_js('index.js', "sell")
            print(success)
            newAction = [datetime.datetime.today(), "sell", df["close"][len(df) - 1], "Held to long."]
            returnAction = [datetime.datetime.today(), (df["close"][len(df) - 1]/current) - 1]
            actionTable.add_row(newAction)
            returnTable.add_row(returnAction)
            print("Held to long")
            current = None
    if df["one_day_growth"][len(df) - 1] >= np.quantile(df["one_day_growth"], 0.65):
        if current != None:
            success = execute_js('index.js', "sell")
            print(success)
            newAction = [datetime.datetime.today(), "sell", df["close"][len(df) - 1], ""]
            returnAction = [datetime.datetime.today(), (df["close"][len(df) - 1]/current) - 1]
            actionTable.add_row(newAction)
            returnTable.add_row(returnAction)
            purchase_date = None
            current = None
    if df["one_day_growth"][len(df) - 1] <= np.quantile(df["one_day_growth"], 0.35):
        if current == None:
            success = execute_js('index.js', "buy")
            print(success)
            newAction = [datetime.datetime.today(), "buy", df["close"][len(df) - 1], ""]
            actionTable.add_row(newAction)
            purchase_date = df["timestamp"][len(df) - 1]
            current = df["close"][len(df) - 1]

    print(actionTable)
    print(returnTable)
    print("\n")
    time.sleep(5*60)
