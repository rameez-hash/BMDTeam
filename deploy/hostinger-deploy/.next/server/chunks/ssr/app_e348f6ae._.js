module.exports=[66917,a=>{"use strict";var b=a.i(87924);function c({variant:a="primary",size:c="md",loading:d=!1,fullWidth:e=!1,children:f,className:g="",disabled:h,...i}){return(0,b.jsxs)("button",{className:`
        inline-flex items-center justify-center font-medium rounded-lg 
        transition-all duration-150 ease-out
        focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1
        disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
        ${{primary:"bg-green-600 hover:bg-green-700 active:bg-green-800 text-white shadow-sm hover:shadow-md",secondary:"bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200",danger:"bg-red-600 hover:bg-red-700 active:bg-red-800 text-white shadow-sm hover:shadow-md",success:"bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm hover:shadow-md",ghost:"hover:bg-slate-100 active:bg-slate-200 text-slate-600",outline:"border-2 border-green-600 text-green-600 hover:bg-green-50 active:bg-green-100"}[a]} ${{sm:"px-2.5 py-1.5 text-xs gap-1.5",md:"px-3.5 py-2 text-sm gap-2",lg:"px-5 py-2.5 text-sm gap-2"}[c]} 
        ${e?"w-full":""}
        ${g}
      `,disabled:h||d,...i,children:[d&&(0,b.jsxs)("svg",{className:"animate-spin h-3.5 w-3.5 flex-shrink-0",viewBox:"0 0 24 24",children:[(0,b.jsx)("circle",{className:"opacity-25",cx:"12",cy:"12",r:"10",stroke:"currentColor",strokeWidth:"4",fill:"none"}),(0,b.jsx)("path",{className:"opacity-75",fill:"currentColor",d:"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"})]}),f]})}a.s(["Button",()=>c])},37942,49043,a=>{"use strict";var b=a.i(87924);function c({children:a,className:c="",padding:d=!0,hover:e=!1}){return(0,b.jsx)("div",{className:`
        bg-white rounded-xl shadow-sm border border-slate-200
        ${d?"p-4 sm:p-5 lg:p-6":""} 
        ${e?"hover:shadow-md hover:border-slate-300 transition-all duration-200":""}
        ${c}
      `,children:a})}function d({children:a,className:c=""}){return(0,b.jsx)("div",{className:`px-4 sm:px-5 lg:px-6 py-3 sm:py-4 border-b border-slate-100 bg-slate-50/40 ${c}`,children:a})}function e({children:a,className:c=""}){return(0,b.jsx)("h3",{className:`text-base sm:text-lg font-semibold text-slate-800 ${c}`,children:a})}function f({children:a,className:c=""}){return(0,b.jsx)("div",{className:`p-4 sm:p-5 lg:p-6 ${c}`,children:a})}function g({children:a,variant:c="default",size:d="sm",dot:e=!1,className:f=""}){return(0,b.jsxs)("span",{className:`
        inline-flex items-center gap-1 rounded-full font-medium border whitespace-nowrap
        ${{default:"bg-slate-100 text-slate-700 border-slate-200",success:"bg-emerald-50 text-emerald-700 border-emerald-200",warning:"bg-amber-50 text-amber-700 border-amber-200",danger:"bg-red-50 text-red-700 border-red-200",info:"bg-blue-50 text-blue-700 border-blue-200",primary:"bg-emerald-50 text-emerald-700 border-emerald-200"}[c]} ${{sm:"px-2 py-0.5 text-[10px]",md:"px-2.5 py-1 text-xs"}[d]} ${f}
      `,children:[e&&(0,b.jsx)("span",{className:`w-1.5 h-1.5 rounded-full flex-shrink-0 ${{default:"bg-gray-500",success:"bg-emerald-500",warning:"bg-amber-500",danger:"bg-red-500",info:"bg-blue-500",primary:"bg-green-500"}[c]}`}),a]})}a.s(["Card",()=>c,"CardContent",()=>f,"CardHeader",()=>d,"CardTitle",()=>e],37942),a.s(["Badge",()=>g],49043)},63187,a=>{"use strict";var b=a.i(87924),c=a.i(72131);let d=(0,c.forwardRef)(({label:a,error:c,hint:d,icon:e,rightIcon:f,onRightIconClick:g,className:h="",...i},j)=>(0,b.jsxs)("div",{className:"w-full",children:[a&&(0,b.jsx)("label",{className:"block text-sm font-medium text-slate-600 mb-1.5",children:a}),(0,b.jsxs)("div",{className:"relative",children:[e&&(0,b.jsx)("div",{className:"absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none",children:e}),(0,b.jsx)("input",{ref:j,className:`
              w-full px-3 py-2.5 bg-white border-b-2 border-slate-200 rounded-none
              text-sm text-slate-900 placeholder-slate-400
              focus:outline-none focus:border-emerald-500
              hover:border-slate-300
              transition-all duration-200
              ${e?"pl-10":""} 
              ${f?"pr-10":""}
              ${c?"border-red-400 focus:border-red-500":""}
              ${i.disabled?"bg-slate-50 text-slate-500 cursor-not-allowed":""}
              ${h}
            `,...i}),f&&(0,b.jsx)("button",{type:"button",onClick:g,className:"absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600 transition-colors focus:outline-none",tabIndex:-1,children:f})]}),d&&!c&&(0,b.jsx)("p",{className:"mt-1 text-xs text-slate-500",children:d}),c&&(0,b.jsx)("p",{className:"mt-1 text-xs sm:text-sm text-red-600",children:c})]}));d.displayName="Input";let e=(0,c.forwardRef)(({label:a,error:c,hint:d,options:e,className:f="",...g},h)=>(0,b.jsxs)("div",{className:a?"w-full":"inline-block",children:[a&&(0,b.jsx)("label",{className:"block text-sm font-medium text-slate-600 mb-1.5",children:a}),(0,b.jsx)("div",{className:"relative",children:(0,b.jsx)("select",{ref:h,className:`
              w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl
              text-sm text-slate-900
              focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500
              hover:border-slate-300
              transition-all duration-200
              appearance-none cursor-pointer
              ${c?"border-red-400 focus:border-red-500 focus:ring-red-500/20":""}
              ${g.disabled?"bg-slate-50 text-slate-500 cursor-not-allowed":""}
              ${f}
            `,style:{backgroundImage:"url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")",backgroundPosition:"right 0.5rem center",backgroundSize:"1.5em 1.5em",backgroundRepeat:"no-repeat",paddingRight:"2.5rem"},...g,children:e.map(a=>(0,b.jsx)("option",{value:a.value,children:a.label},a.value))})}),d&&!c&&(0,b.jsx)("p",{className:"mt-1 text-xs text-slate-500",children:d}),c&&(0,b.jsx)("p",{className:"mt-1 text-xs sm:text-sm text-red-600",children:c})]}));e.displayName="Select",a.s(["Input",0,d,"Select",0,e])},47038,a=>{"use strict";var b=a.i(87924);function c({module:a,message:c}){return(0,b.jsx)("div",{className:"flex items-center justify-center min-h-[60vh]",children:(0,b.jsxs)("div",{className:"text-center max-w-md mx-auto p-8",children:[(0,b.jsx)("div",{className:"w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4",children:(0,b.jsx)("svg",{className:"w-8 h-8 text-red-500",fill:"none",stroke:"currentColor",strokeWidth:1.5,viewBox:"0 0 24 24",children:(0,b.jsx)("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"})})}),(0,b.jsx)("h2",{className:"text-xl font-semibold text-slate-900 mb-2",children:"Access Denied"}),(0,b.jsx)("p",{className:"text-slate-500 text-sm",children:c||`You don't have permission to access ${a?`the ${a} section`:"this page"}. Contact your administrator to request access.`})]})})}a.s(["default",()=>c])},45327,a=>{"use strict";var b=a.i(72131),c=a.i(10918);function d(a,d){let{user:e,loading:f,hasPermission:g,getPermissionScope:h}=(0,c.useAuth)(),[i,j]=(0,b.useState)(!1);return((0,b.useEffect)(()=>{!f&&e&&j(!0)},[f,e]),f||!i)?{allowed:!1,loading:!0,scope:null}:e?{allowed:g(a,d),loading:!1,scope:h(a,d)}:{allowed:!1,loading:!1,scope:null}}a.s(["useRequirePermission",()=>d])}];

//# sourceMappingURL=app_e348f6ae._.js.map