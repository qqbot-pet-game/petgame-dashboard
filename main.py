import web

import os
import sys
import MySQLdb
import ConfigParser
import requests
import json
import time

reload(sys)
sys.setdefaultencoding("utf-8")

root_path = os.path.split(os.path.realpath(__file__))[0] + '/'

config_path = root_path + './config.conf'

config = ConfigParser.ConfigParser()
config.read(config_path)

mysql_host = config.get('database', 'host')
mysql_port = int(config.get('database', 'port'))
mysql_username = config.get('database', 'username')
mysql_password = config.get('database', 'password')
mysql_dbname = config.get('database', 'db')

connection_timeout = int(config.get('connection', 'timeout'))

# _connect_retain_cnt = 0
# conn = None
# cur = None

def db_connect():
    # if _connect_retain_cnt == 0:
    conn = MySQLdb.connect(
        host = mysql_host,
        port = mysql_port,
        user = mysql_username,
        passwd = mysql_password,
        db = mysql_dbname)
    cur = conn.cursor()
    return (conn, cur)
    # _connect_retain_cnt += 1
def db_close(conn, cur, commit = True):
    # if not _connect_retain_cnt > 1:
    cur.close()
    if commit: conn.commit()
    conn.close()
    # _connect_retain_cnt -= 1

urls = (
    '/', 'Index',
    '^/request/([^:/]+):(\d+)/(.+)$', 'ApiRequest',
    '/api/host', 'ApiHost',
    '/api/host/delete', 'ApiHostDelete',
    '/api/host/status', 'ApiHostStatus',
    '/api/host/launch', 'ApiHostLaunch',
    '/api/host/shutdown', 'ApiHostShutdown',
    '/api/host/gnamelist', 'ApiHostGnamelist',
    '/api/host/config', 'ApiHostConfig'
)

def get_host_id():
    inputdata = web.input(host = None)
    if inputdata.host is None or not inputdata.host.isdigit(): return None
    else: return int(inputdata.host)
def getHosts():
    (conn, cur) = db_connect()
    hosts = []
    cur.execute('SELECT id, name, addr, port FROM hosts')
    while True:
        host = cur.fetchone()
        if host is None: break
        hosts.append({'id': host[0], 'name': host[1], 'addr': host[2], 'port': host[3]})
    db_close(conn, cur)
    return hosts
def getHost(host_id):
    (conn, cur) = db_connect()
    if not cur.execute('SELECT id, name, addr, port FROM hosts WHERE id = {0}'.format(host_id)):
        web.ctx.status = 404
        return "Host not found"
    host = cur.fetchone()
    db_close(conn, cur)
    return {'id': host[0], 'name': host[1], 'addr': host[2], 'port': host[3]}

class Index:
    def GET(self):
        render = web.template.render('templates')
        return render.index()
    def POST(self):
        web.ctx.status = 404
        return

class ApiHost:
    """
    Insert status:
    -- 0: success
    -- 1: exists
    """
    def GET(self):
        hostid = get_host_id()
        if hostid: return json.dumps(getHost(hostid))
        else: return json.dumps(getHosts())
    def POST(self):
        hostid = get_host_id()
        doinsert = hostid is None
        postdata = json.loads(web.data())
        set_clauses = []
        if 'name' in postdata: set_clauses.append('name = "{0}"'.format(postdata['name']))
        elif doinsert: raise ValueError("name not set")
        if 'addr' in postdata: set_clauses.append('addr = "{0}"'.format(postdata['addr']))
        elif doinsert: raise ValueError("addr not set")
        if 'port' in postdata and isinstance(postdata['port'], int): set_clauses.append('port = {0}'.format(postdata['port']))
        elif doinsert: raise ValueError("port not set or not valid")
        (conn, cur) = db_connect()
        data = None
        status = 0
        if doinsert:
            if cur.execute('SELECT id FROM hosts WHERE addr = "{0}" AND port = {1}'.format(postdata['addr'], postdata['port'])):
                status = 1
            elif not cur.execute('INSERT INTO hosts (name, addr, port) VALUES ("{0}", "{1}", {2})'.format( \
                    postdata['name'], postdata['addr'], postdata['port'])) or \
                    not cur.execute('SELECT id FROM hosts WHERE addr = "{0}" AND port = {1}'.format(postdata['addr'], postdata['port'])):
                db_close(conn, cur, False)
                raise Exception("database error");
            else:
                data = {'id': cur.fetchone()[0]}
        else:
            if cur.execute('SELECT id FROM hosts WHERE addr = "{0}" AND port = {1} AND id <> {2}'.format(postdata['addr'], postdata['port'], postdata['id'])):
                status = 1
            cur.execute('UPDATE hosts SET {0} WHERE id = {1}'.format(', '.join(set_clauses), hostid))
                # db_close(conn, cur, False)
                # raise Exception("database error");
        db_close(conn, cur, status == 0)
        return json.dumps({"status": status, "data": data})

class ApiHostDelete:
    def GET(self):
        hostid = get_host_id()
        if hostid is None: raise KeyError("host id not provided")
        status = 0
        (conn, cur) = db_connect()
        if not cur.execute('DELETE FROM hosts WHERE id = {0}'.format(hostid)):
            status = 1
        db_close(conn, cur, status == 0)
        return json.dumps({"status": status})

class ApiRequest:
    def GET(self, addr, port, postfix):
        postfix = postfix.replace('|', '?')
        url = "http://{0}:{1}/{2}".format(addr, port, postfix)
        print "[Requests] [GET]  %s" % url
        # r = requests.get(url, timeout = connection_timeout)
        r = requests.get(url)
        if r.status_code != 200: web.ctx.status = r.status_code
        return r.text
    def POST(self, addr, port, postfix):
        postfix = postfix.replace('|', '?')
        url = "http://{0}:{1}/{2}".format(addr, port, postfix)
        print "[Requests] [POST] %s" % url
        # r = requests.post(url, data = web.data(), timeout = connection_timeout)
        r = requests.post(url, data = web.data())
        if r.status_code != 200: web.ctx.status = r.status_code
        return r.text

if __name__ == '__main__':
    app = web.application(urls, globals())
    app.run()