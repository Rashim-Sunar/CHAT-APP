import React from "react";

function GenderCheckbox({ handleCheckboxChange, selectedGender }) {
  return (
    <div className="flex gap-6 mb-6">

      {["male", "female"].map((gender) => (
        <button
          key={gender}
          type="button"
          onClick={() => handleCheckboxChange(gender)}
          className={`px-8 py-3 rounded-xl border transition-all duration-200
            ${
              selectedGender === gender
                ? "bg-indigo-600 text-white border-indigo-600"
                : "bg-white text-slate-700 border-slate-300 hover:border-indigo-400"
            }`}
        >
          {gender.charAt(0).toUpperCase() + gender.slice(1)}
        </button>
      ))}

    </div>
  );
}

export default GenderCheckbox;
