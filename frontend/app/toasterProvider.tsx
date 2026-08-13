"use client";
import { Toaster } from "react-hot-toast";
export default function ToastProvider(){
    return(
     <Toaster
      position="top-right"
      toastOptions={{
        duration: 2500,
        style: {
          background: "var(--panel)",
          color: "var(--text)",
          border: "1px solid var(--line)",
          fontSize: "13px",
        },
      }}
    />
    );
}