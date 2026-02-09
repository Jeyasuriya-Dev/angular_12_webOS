export class clienturl {

    static CURRENT_VERSION(): String {
        return "v1.1"
    }

    static RELEASE_DATE(): String {

        return "Monday, 18 August 2025";
    }

    static LOGIC_LOGS(): boolean {

        return true;
    }

    static SERVER_URL(): String {

        return 'https://ds.iqtv.in:8080/iqserver/api/server/getserverdetails';
        //  return 'http://192.168.70.100:8585/iqserver/api/server/getserverdetails';
    }


    static WEB_URL(): String {

        return "https://ds.iqtv.in";
        // return "http://192.168.70.100";

    }
    static AUTH_URL(): String {
        
        return 'https://ds.iqtv.in:8080/iqworld/api/auth';
        //  return 'http://192.168.70.100:8585/iqworld/api/auth';
    }

    static BASE_URL(): String {

        return 'https://ds.iqtv.in:8080/iqworld';
        //  return 'http://192.168.70.100:8585/iqworld';
    }
}