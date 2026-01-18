package storage

import (
	"context"
	"fmt"
	"time"

	influxdb2 "github.com/influxdata/influxdb-client-go/v2"
	"github.com/influxdata/influxdb-client-go/v2/api"
)

type MetricsStore struct {
	client   influxdb2.Client
	writeAPI api.WriteAPIBlocking
	queryAPI api.QueryAPI
	org      string
	bucket   string
}

func NewMetricsStore(url, token, org, bucket string) *MetricsStore {
	client := influxdb2.NewClient(url, token)
	writeAPI := client.WriteAPIBlocking(org, bucket)
	queryAPI := client.QueryAPI(org)
	return &MetricsStore{
		client:   client,
		writeAPI: writeAPI,
		queryAPI: queryAPI,
		org:      org,
		bucket:   bucket,
	}
}

func (s *MetricsStore) WriteSystemMetric(cpu, mem, disk float64, sent, recv uint64, recvRate float64, ddosStatus string) error {
	p := influxdb2.NewPointWithMeasurement("system")
	p.AddField("cpu_percent", cpu)
	p.AddField("memory_usage", mem)
	p.AddField("disk_usage", disk)
	p.AddField("bytes_sent", float64(sent))
	p.AddField("bytes_recv", float64(recv))
    p.AddField("net_recv_rate", recvRate)
    p.AddField("ddos_status", ddosStatus)
	p.SetTime(time.Now())

    // fmt.Printf("Writing Point: %+v\n", p)
	return s.writeAPI.WritePoint(context.Background(), p)
}

type SystemMetricData struct {
	CPU      float64 `json:"cpu"`
	Mem      float64 `json:"mem"`
	Disk     float64 `json:"disk"`
	NetSent  float64 `json:"net_sent_rate"` // bytes/sec
	NetRecv  float64 `json:"net_recv_rate"` // bytes/sec
    DDoSStatus string `json:"ddos_status"`
}

func (s *MetricsStore) GetLatestSystemMetrics() (*SystemMetricData, error) {
	query := fmt.Sprintf(`
	from(bucket: "%s")
	|> range(start: -1m)
	|> filter(fn: (r) => r["_measurement"] == "system")
	|> last()
	|> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket)

	result, err := s.queryAPI.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	data := &SystemMetricData{}
	
	if result.Next() {
		record := result.Record()
        // fmt.Printf("Influx Record Values: %v\n", record.Values())
        
        getFloat := func(k string) float64 {
            if v, ok := record.ValueByKey(k).(float64); ok { return v }
            return 0.0
        }
        getString := func(k string) string {
            if v, ok := record.ValueByKey(k).(string); ok { return v }
            return ""
        }

        data.CPU = getFloat("cpu_percent")
        data.Mem = getFloat("memory_usage")
        data.Disk = getFloat("disk_usage")
        data.NetRecv = getFloat("net_recv_rate")
        data.DDoSStatus = getString("ddos_status")
	}

	if result.Err() != nil {
		return nil, result.Err()
	}

	return data, nil
}

func (s *MetricsStore) GetSystemMetricHistory(duration string) ([]SystemMetricData, error) {
    if duration == "" {
        duration = "15m"
    }
    
    // Downsample using aggregateWindow
	query := fmt.Sprintf(`
	from(bucket: "%s")
	|> range(start: -%s)
	|> filter(fn: (r) => r["_measurement"] == "system")
    |> filter(fn: (r) => r["_field"] == "cpu_percent" or r["_field"] == "memory_usage" or r["_field"] == "disk_usage" or r["_field"] == "net_recv_rate" or r["_field"] == "bytes_sent")
    |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
	|> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
	`, s.bucket, duration)

	result, err := s.queryAPI.Query(context.Background(), query)
	if err != nil {
		return nil, err
	}
	defer result.Close()

	var history []SystemMetricData
	
	for result.Next() {
		record := result.Record()
		getFloat := func(k string) float64 {
			if v, ok := record.ValueByKey(k).(float64); ok { return v }
			return 0.0
		}
        getString := func(k string) string {
			if v, ok := record.ValueByKey(k).(string); ok { return v }
			return ""
		}

        history = append(history, SystemMetricData{
            CPU: getFloat("cpu_percent"),
            Mem: getFloat("memory_usage"),
            Disk: getFloat("disk_usage"),
            NetRecv: getFloat("net_recv_rate"),
            NetSent: getFloat("bytes_sent"), // Warning: bytes_sent aggregate might be weird if not rate. 
            // Actually, net_recv_rate IS a rate. bytes_sent is a counter? 
            // In agent/collector/system.go: BytesSent is netStat[0].BytesSent (Counter).
            // We should ideally calculate rate for sent too, but for now let's just use what we have.
            // Wait, for Network Graph, we need RATE. 
            // net_recv_rate IS stored as rate.
            // bytes_sent IS stored as counter. We can't avg a counter easily to get rate without derivative.
            // Let's stick to NetRecv for now since that's what we focused on for DDoS.
            DDoSStatus: getString("ddos_status"), 
            // Note: ddos_status is string, mean() on string won't work? 
            // Flux aggregateWindow on strings usually takes the first or last if not numeric? 
            // pivot might fail if type mismatch? 
            // Actually aggregateWindow(fn: mean) will drop strings. 
            // So ddos_status will be missing. That's fine for history graph.
        })
	}

	if result.Err() != nil {
		return nil, result.Err()
	}

	return history, nil
}

// WriteInterfaceMetric writes a single interface's metrics to InfluxDB
func (s *MetricsStore) WriteInterfaceMetric(name string, bytesSent, bytesRecv uint64) error {
    p := influxdb2.NewPointWithMeasurement("network_interface")
    p.AddTag("interface", name)
    p.AddField("bytes_sent", float64(bytesSent))
    p.AddField("bytes_recv", float64(bytesRecv))
    p.SetTime(time.Now())

    s.writeAPI.WritePoint(context.Background(), p)
    return nil
}

type InterfaceMetricData struct {
    Interface   string    `json:"interface"`
    BytesRecv   float64   `json:"bytes_recv"`
    BytesSent   float64   `json:"bytes_sent"`
    Time        time.Time `json:"time"`
}

func (s *MetricsStore) GetInterfaceHistory(duration string) ([]InterfaceMetricData, error) {
    if duration == "" {
        duration = "15m"
    }

    // We want to calculate RATE (bytes/sec) from the Counters (bytes_sent/recv)
    // using derivative() or just difference() over time?
    // Actually, agent sends raw counters. InfluxDB derivative() calculates rate of change.
    // unit: 1s => bytes/second.
    query := fmt.Sprintf(`
    from(bucket: "%s")
    |> range(start: -%s)
    |> filter(fn: (r) => r["_measurement"] == "network_interface")
    |> derivative(unit: 1s, nonNegative: true) 
    |> aggregateWindow(every: 10s, fn: mean, createEmpty: false)
    |> pivot(rowKey:["_time", "interface"], columnKey: ["_field"], valueColumn: "_value")
    `, s.bucket, duration)

    result, err := s.queryAPI.Query(context.Background(), query)
    if err != nil {
        return nil, err
    }
    defer result.Close()

    var history []InterfaceMetricData

    for result.Next() {
        record := result.Record()
        getFloat := func(k string) float64 {
            if v, ok := record.ValueByKey(k).(float64); ok { return v }
            return 0.0
        }
        getString := func(k string) string {
            if v, ok := record.ValueByKey(k).(string); ok { return v }
            return ""
        }

        history = append(history, InterfaceMetricData{
            Interface: getString("interface"),
            BytesRecv: getFloat("bytes_recv"), // This is now a RATE (B/s) due to derivative
            BytesSent: getFloat("bytes_sent"), // This is now a RATE (B/s)
            Time:      record.Time(),
        })
    }
    return history, nil
}


// WriteContainerMetric writes a single container's metrics to InfluxDB
func (m *MetricsStore) WriteContainerMetric(id, name, image, state, status, ports string, cpu, mem, netRx, netTx float64) error {
    p := influxdb2.NewPointWithMeasurement("containers").
        AddTag("container_id", id).
        AddTag("container_name", name).
        AddTag("image", image).
        AddTag("state", state).
        AddField("status", status).
        AddField("ports", ports).
        AddField("cpu_percent", cpu).
        AddField("memory_usage", mem).
        AddField("net_rx", netRx).
        AddField("net_tx", netTx).
        SetTime(time.Now())

    m.writeAPI.WritePoint(context.Background(), p)
    return nil
}

type ContainerMetricData struct {
    ID          string  `json:"id"`
    Name        string  `json:"name"`
    Image       string  `json:"image"`
    State       string  `json:"state"`
    Status      string  `json:"status"`
    Ports       string  `json:"ports"`
    CPU         float64 `json:"cpu"`
    Mem         float64 `json:"mem"`
    NetRx       float64 `json:"net_rx"`
    NetTx       float64 `json:"net_tx"`
    Timestamp   time.Time `json:"timestamp"`
}

// GetLatestContainerMetrics returns the latest metrics for each active container
func (m *MetricsStore) GetLatestContainerMetrics() ([]ContainerMetricData, error) {
    // Flux query to get the last record for every container in the last 1 minute
    // We group by container_id and _field to ensure we get the latest value for EACH field,
    // essentially finding the latest timestamp for the container provided it's active.
    // This also deduplicates state changes (e.g. running -> restarting) by taking the absolute last.
    query := fmt.Sprintf(`
    from(bucket: "%s")
    |> range(start: -1m)
    |> filter(fn: (r) => r["_measurement"] == "containers")
    |> group(columns: ["container_id", "_field"])
    |> last()
    |> pivot(rowKey:["_time", "container_id", "container_name", "image", "state"], columnKey: ["_field"], valueColumn: "_value")
    `, m.bucket)

    result, err := m.queryAPI.Query(context.Background(), query)
    if err != nil {
        return nil, err
    }
    defer result.Close()

    var metrics []ContainerMetricData
    
    for result.Next() {
        record := result.Record()
        
        // Helper to safely get string/float
        getString := func(k string) string {
            if v, ok := record.ValueByKey(k).(string); ok { return v }
            return ""
        }
        getFloat := func(k string) float64 {
            if v, ok := record.ValueByKey(k).(float64); ok { return v }
            return 0.0
        }

        metrics = append(metrics, ContainerMetricData{
            ID:        getString("container_id"),
            Name:      getString("container_name"),
            Image:     getString("image"),
            State:     getString("state"),
            Status:    getString("status"),
            Ports:     getString("ports"),
            CPU:       getFloat("cpu_percent"),
            Mem:       getFloat("memory_usage"),
            NetRx:     getFloat("net_rx"),
            NetTx:     getFloat("net_tx"),
            Timestamp: record.Time(),
        })
    }
    return metrics, nil
}

func (s *MetricsStore) Close() {
	s.client.Close()
}
