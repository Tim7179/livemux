<?xml version="1.0" encoding="utf-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
<xsl:output method="html"/>
<xsl:template match="/">
<html>
<head>
<title>RTMP Statistics</title>
<style>
  body { font-family: monospace; background: #0f0f0f; color: #ccc; padding: 20px; }
  h2 { color: #fff; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
  th { background: #222; color: #4fc3f7; padding: 8px; text-align: left; }
  td { padding: 6px 8px; border-bottom: 1px solid #222; }
  .on { color: #66bb6a; } .off { color: #ef5350; }
</style>
</head>
<body>
<h2>nginx-rtmp statistics</h2>
<table>
<tr><th>Field</th><th>Value</th></tr>
<tr><td>nginx version</td><td><xsl:value-of select="/root/nginx_version"/></td></tr>
<tr><td>nginx-rtmp version</td><td><xsl:value-of select="/root/ngx_rtmp_version"/></td></tr>
<tr><td>built</td><td><xsl:value-of select="/root/built"/></td></tr>
<tr><td>pid</td><td><xsl:value-of select="/root/pid"/></td></tr>
<tr><td>uptime</td><td><xsl:value-of select="/root/uptime"/>s</td></tr>
<tr><td>accepted</td><td><xsl:value-of select="/root/naccepted"/></td></tr>
<tr><td>bw_in</td><td><xsl:value-of select="/root/bw_in"/> bit/s</td></tr>
<tr><td>bw_out</td><td><xsl:value-of select="/root/bw_out"/> bit/s</td></tr>
</table>

<xsl:for-each select="/root/server/application">
<h2>Application: <xsl:value-of select="name"/></h2>
<xsl:if test="live/stream">
<table>
<tr><th>Stream</th><th>Clients</th><th>BW in</th><th>BW out</th><th>Time</th></tr>
<xsl:for-each select="live/stream">
<tr>
  <td><xsl:value-of select="name"/></td>
  <td><xsl:value-of select="nclients"/></td>
  <td><xsl:value-of select="bw_in"/> bit/s</td>
  <td><xsl:value-of select="bw_out"/> bit/s</td>
  <td><xsl:value-of select="time"/>ms</td>
</tr>
</xsl:for-each>
</table>
</xsl:if>
</xsl:for-each>
</body>
</html>
</xsl:template>
</xsl:stylesheet>
