import React, { createContext, useCallback, useContext, useEffect, useState} from "react";
import api from "../api/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { SearchAlert } from "lucide-react";
import debounce from "lodash.debounce"; 

const AppContext = createContext(undefined);

export function AppContentProvider({children}) {

    const navigate = useNavigate();

    // Auth states
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);

    // states
    const [projects, setProjects] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [activeProjects, setActiveProjects] = useState(null);
    const [loadingActiveProject, setLoadingActiveProject] = useState(true);
    const [chatLoading, setChatLoading] = useState(false);
    const [generatingProject, setGeneratingProject] = useState(false);
    const [activeFile, setActiveFile] = useState("/App.js");
    const [showCode, setShowCode] = useState(false);

    // Auth Actions
    const checkSession = async ()=> {
        try {
          const {data} = await api.get("/api/auth/me");
          setUser(data.user);
        }
        catch(error) {
          setUser(null)
        } finally{
            setLoadingUser(false)
        }
    }

    useEffect(()=>{
      checkSession()
    },[])

    const login = async (email, password) => {
        try {
            const { data } = await api.post("/api/auth/login", {email, password});
            setUser(data.user)
            toast.success("welcome back!");
            navigate("/")
        } catch (err) {
            console.error("Login failed:", err);
            const errMsg = err?.response?.data?.error || "Invalid email or password";
            toast.error(errMsg);
            throw new Error(errMsg);
        }
    }

     const register = async (name, email, password) => {
        try {
            const { data } = await api.post("/api/auth/register", {name, email, password});
            setUser(data.user)
            toast.success("Account created successfully!");
            navigate("/")
        } catch (err) {
            console.error("Registration failed:", err);
            const errMsg = err?.response?.data?.error || "Registration failed";
            toast.error(errMsg);
            throw new Error(errMsg);
        }
    }

    const logout = async ()=> {
        try {
            await api.post("/api/auth/logout")
            setUser(null)
            setProjects([])
            setActiveProjects(null)
            toast.success("Logged out successfully")
            navigate("/login")
        } catch (err) {
            console.log("Logout failed:", err);
            toast.error("Logout failed");
        }
    }

    // Projects Actions
    const loadProjects = async () => {
        if(!user) return;
        try {
            const { data } = await api.get("/api/projects")
            setProjects(data)
        } catch (err) {
            console.error("Failed to list projects:", err);
            toast.error("Failed to load projects list");
        } finally {
            setLoadingProjects(false);
        }
    }

    const loadProject = async (id, silent = false)=> {
        if(!user) return;
        if(!silent) setLoadingActiveProject(true)
            try {
                const { data } = await api.get(`/api/projects/${id}`)
                setActiveProjects(data);

                // Default file selection
                const files = Object.keys(data.files);
                if(files.length > 0) {
                    setActiveFile((prev)=> {
                        if(files.includes(prev)) return prev;
                        if(files.includes("/App.js")) return "App.js";
                        return files[0]
                    })
                }
            } catch (err) {
                console.log("Failed to load project:", err);
                if(!silent) {
                    toast.error("Failed to load project details");
                    navigate("/");
                }
            } finally {
                if(!silent) setLoadingActiveProject(false)
            }
    }
      
       // Automatically poll active project status if generating or pending
       useEffect(()=>{
        if (!activeProjects?._id || !user) return;

        const isOngoing = activeProjects.status === "generating" || activeProjects.status === "pending" || activeProjects.status === "revising";

        if(isOngoing) {
            setChatLoading(true);
            const interval = setInterval(()=>{
                loadProject(activeProjects._id,true)
            }, 2000);
            return ()=> clearInterval(interval)
        } else {
            setChatLoading(false);
        }
       }, [activeProjects?._id, activeProjects?.status, loadProject, user])

       const handleGenerate = useCallback(
        async (prompt) => {
           if(!user) return;

           setGeneratingProject(true); 
           try {
            const { data } = await api.post("/api/projects", { prompt });
            toast.success("AI Agent is planning structure...")
            navigate(`/builder/${data._id}`);
           } catch(err) {
              console.error("Failed to generate project:", err);
              toast.error(err?.response?.data?.error || "Failed to generate project");
           } finally {
            setGeneratingProject(false);
           }

        }, [navigate, user]
       )

       const handleDelete = useCallback(
        async (id) => {
           if(!user) return;

           try {
            await api.delete(`/api/projects/${id}`);
            setProjects((prev)=>prev.filter((p)=>p._id!==id))
            toast.success("Project deleted successfully")
           } catch(err) {
              console.error("Failed to generate project:", err);
              toast.error("Failed to generate project");
           } 
        }, [user]
       )

       const handleChat = useCallback(
         async (prompt)=>{
            if(!activeProjects || !user) return;
            setChatLoading(true)
            try {
                const { data } = await api.post(`/api/projects/${activeProjects._id}/chat`,
                    {prompt});
                    setActiveProjects(data)
                    if(data.errors && data.errors.length > 0) {
                        toast.error(`${data.errors.length} revision patch(es) failed`);
                    } else {
                        toast.success(`Updated to version ${data.version}`);
                    }
            } catch (err) {
                console.log("Revision request failed", err);
                toast.error(err?.response?.data?.error || "Revision request failed");
            } finally{
                         setChatLoading(false)
                    }
         },[activeProjects, user]
       )

       const debounceSave = React.useMemo(
        ()=>debounce(async(files, id)=> {
            try {
                await api.put(`/api/projects/${id}/files`, {files})
            } catch (err) {
                console.error("Failed to auto-save files:", err);
                toast.error("Failed to save code modifications");
            }
        }, 1000), [],
       )

       useEffect(()=>{
         return ()=> {
            debounceSave.cancel();
         }
       }, [debounceSave])

       const updateProjectFiles = useCallback(
        async (files) => {
            if(!activeProjects || !user) return;
            debounceSave(files, activeProjects._id)
        }, [activeProjects, user, debounceSave]
       )


       return (
        <AppContext.Provider value={{
            user,
            loadingUser,
            login,
            register,
            projects,
            loadingProjects,
            activeProjects,
            loadingActiveProject,
            chatLoading,
            generatingProject,
            activeFile,
            showCode,
            setActiveFile,
            setShowCode,
            loadProjects,
            loadProject,
            handleGenerate,
            handleDelete,
            handleChat,
            logout,
            updateProjectFiles
        }}>

            {children}
        </AppContext.Provider>
       )
}

export function useAppContext() {
    const context = useContext(AppContext);
    if(context === undefined) {
        throw new Error("useAppContext must be used within an AppContextProvider");
    }
    return context;

}