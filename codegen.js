export function generateJavaCode(rawBlocks, isForExecution = false) {
  let code = "";
  let error = null;
  // FIX: Added blockId as the 6th parameter
  function reportError(
    title,
    message,
    detail,
    hint,
    searchString,
    blockId = null,
  ) {
    if (!error) error = { title, message, detail, hint, searchString, blockId };
  }

  function hasInputBlock(nodes) {
    if (!nodes) return false;
    for (const node of nodes) {
      if (node.type === "op-input") return true;
      if (node.children && hasInputBlock(node.children)) return true;
    }
    return false;
  }

  // --- SMART FORMATTER ENGINE ---
  function needsBlankLine(prev, curr) {
    if (!prev) return false;
    const isDecl = (t) =>
      ["variable", "variable-value", "new-object"].includes(t);
    const isControl = (t) =>
      ["if", "for", "while", "do-while", "switch"].includes(t);

    if (isDecl(prev.type) && !isDecl(curr.type)) return true;
    if (!isControl(prev.type) && isControl(curr.type)) return true;
    if (isControl(prev.type) && !["else-if", "else"].includes(curr.type))
      return true;
    if (curr.type === "return") return true;
    if (
      curr.type === "print" &&
      ["prop-assign", "object-caller", "variable-value", "new-object"].includes(
        prev.type,
      )
    )
      return true;

    return false;
  }

  function generateBlockChildren(children, indent) {
    if (!children) return;
    let prevNode = null;
    children.forEach((c) => {
      if (c.type !== "parameter" && !c.type.startsWith("op-")) {
        if (needsBlankLine(prevNode, c)) code += `\n`;
        generateInnerStatement(c, indent, true);
        prevNode = c;
      }
    });
  }

  function stripGhosts(blockList) {
    return blockList
      .filter((b) => !b.isGhost && b.id !== "ghost-block")
      .map((b) => {
        const newB = { ...b };
        if (newB.children) newB.children = stripGhosts(newB.children);
        return newB;
      });
  }
  const blocks = stripGhosts(rawBlocks);

  if (hasInputBlock(blocks)) {
    code += "import java.util.Scanner;\n\n";
  }

  const classBlocks = blocks.filter((b) => b.type === "class");
  const interfaceBlocks = blocks.filter((b) => b.type === "interface");

  const classNames = classBlocks.map((b) => b.data.name?.trim());
  const interfaceNames = interfaceBlocks.map((b) => b.data.name?.trim());
  const allNames = [...classNames, ...interfaceNames];
  const uniqueNames = new Set(allNames);

  if (allNames.some((name) => !name)) {
    const emptyBlock = [...classBlocks, ...interfaceBlocks].find(
      (b) => !b.data.name,
    );
    const hasEmptyClass = classBlocks.some((b) => !b.data.name);
    const searchTarget = hasEmptyClass ? "class " : "interface ";

    reportError(
      "Nama Kosong",
      "Terdapat class atau interface yang tidak memiliki nama.",
      "",
      "Harap pastikan semua blok class dan interface telah terisi namanya.",
      searchTarget,
      emptyBlock ? emptyBlock.id : null,
    );
  }

  if (uniqueNames.size !== allNames.length) {
    let dupName = "";
    const seen = new Set();
    for (const name of allNames) {
      if (!name) continue;
      if (seen.has(name)) {
        dupName = name;
        break;
      }
      seen.add(name);
    }

    const dupBlocks = [...classBlocks, ...interfaceBlocks].filter(
      (b) => b.data.name === dupName,
    );
    const duplicateBlock =
      dupBlocks.length > 1 ? dupBlocks[dupBlocks.length - 1] : dupBlocks[0];

    const isInterface = interfaceBlocks.some((b) => b.data.name === dupName);
    const keyword = isInterface ? "interface" : "class";

    reportError(
      "Nama Duplikat",
      `Terdapat duplikasi nama pada class atau interface '${dupName}'.`,
      "",
      "Setiap class dan interface harus memiliki nama yang unik.",
      `${keyword} ${dupName}`,
      duplicateBlock ? duplicateBlock.id : null,
    );
  }

  function getNodeDepth(nodeName, visited = new Set()) {
    if (visited.has(nodeName)) {
      const path = Array.from(visited).join(" → ") + " → " + nodeName;
      const badBlock = [...classBlocks, ...interfaceBlocks].find(
        (b) => b.data.name === nodeName,
      );

      reportError(
        "Circular Dependency Ditemukan",
        "Terjadi Circular Dependency (Ketergantungan Melingkar)",
        path,
        "Harap perbaiki struktur extends pewarisan class/interface.",
        `extends ${nodeName}`,
        badBlock ? badBlock.id : null,
      );
      return 0;
    }

    const currentPath = new Set(visited);
    currentPath.add(nodeName);

    const nodeBlock = [...classBlocks, ...interfaceBlocks].find(
      (b) => b.data.name === nodeName,
    );
    if (!nodeBlock) return 0;

    const extendsBlock = nodeBlock.children.find((c) => c.type === "extends");
    if (!extendsBlock || !extendsBlock.data.superClass) return 0;

    if (extendsBlock.data.superClass === nodeName) {
      reportError(
        "Pewarisan Diri Sendiri",
        `'${nodeName}' mencoba melakukan extends pada dirinya sendiri.`,
        "",
        "Sebuah class/interface tidak bisa mewarisi dirinya sendiri.",
        `extends ${nodeName}`,
        extendsBlock.id,
      );
      return 0;
    }

    return 1 + getNodeDepth(extendsBlock.data.superClass, currentPath);
  }

  classBlocks.forEach((b) => getNodeDepth(b.data.name));
  interfaceBlocks.forEach((b) => getNodeDepth(b.data.name));

  function checkHasReturnValue(block) {
    if (block.type === "return" && block.children && block.children.length > 0)
      return true;
    if (block.children) {
      return block.children.some(checkHasReturnValue);
    }
    return false;
  }

  const javaKeywords = new Set([
    "abstract",
    "assert",
    "boolean",
    "break",
    "byte",
    "case",
    "catch",
    "char",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "double",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "float",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "new",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "short",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "try",
    "void",
    "volatile",
    "true",
    "false",
    "null",
  ]);
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  // FIX: Added blockId parameter
  function validateName(name, type, contextName, searchTarget, blockId = null) {
    if (!name) return;

    const target = searchTarget || name;

    if (!validIdentifierRegex.test(name)) {
      reportError(
        "Penamaan Tidak Valid",
        `Nama ${type} '${name}' (di dalam ${contextName}) tidak valid.`,
        "Dalam Java, nama hanya boleh menggunakan huruf, angka, _, $, tanpa spasi, dan tidak diawali angka.",
        `Ganti nama menjadi format yang benar tanpa simbol/spasi.`,
        target,
        blockId,
      );
    } else if (javaKeywords.has(name)) {
      reportError(
        "Keyword Bawaan Terdeteksi",
        `Nama '${name}' tidak boleh digunakan.`,
        `Kata '${name}' sudah direservasi oleh sistem Java (Reserved Keyword).`,
        "Pilih nama lain yang deskriptif.",
        target,
        blockId,
      );
    } else if (type === "class" || type === "interface") {
      if (/^[a-z]/.test(name)) {
        reportError(
          "Konvensi Penamaan Java",
          `Nama ${type} '${name}' sebaiknya diawali dengan huruf kapital (PascalCase).`,
          "Standar industri dan aturan Java mengharuskan nama blueprint diawali huruf besar.",
          `Ubah menjadi '${name.charAt(0).toUpperCase() + name.slice(1)}'.`,
          target,
          blockId,
        );
      }
    } else if (
      type === "atribut" ||
      type === "variabel lokal" ||
      type === "method"
    ) {
      if (/^[A-Z]/.test(name)) {
        reportError(
          "Konvensi Penamaan Java",
          `Nama ${type} '${name}' sebaiknya diawali dengan huruf kecil (camelCase).`,
          "Standar industri Java mengharuskan nama objek, properti, dan perilaku diawali huruf kecil.",
          `Ubah menjadi '${name.charAt(0).toLowerCase() + name.slice(1)}'.`,
          target,
          blockId,
        );
      }
    }
  }

  function checkOrphanedControlFlow(children) {
    let prevType = null;
    children.forEach((child) => {
      if (child.type === "else-if" || child.type === "else") {
        if (prevType !== "if" && prevType !== "else-if") {
          reportError(
            "Struktur Logika Tidak Valid",
            `Blok '${child.type}' tidak bisa berdiri sendiri.`,
            "",
            `Pastikan blok '${child.type}' diletakkan tepat di bawah blok 'if' atau 'else-if'.`,
            child.type === "else" ? "else {" : "else if",
            child.id,
          );
        }
      }
      prevType = child.type;
      if (child.children && child.children.length > 0)
        checkOrphanedControlFlow(child.children);
    });
  }

  function validateConditionAttached(block) {
    const requiresCondition = [
      "if",
      "else-if",
      "while",
      "do-while",
      "switch",
      "case",
    ];
    if (requiresCondition.includes(block.type)) {
      const hasCondition =
        block.children && block.children.some((c) => c.type.startsWith("op-"));
      if (!hasCondition) {
        reportError(
          "Kondisi Kosong",
          `Blok '${block.type}' membutuhkan kondisi (blok logika/nilai).`,
          "",
          `Harap pasang blok operator/logika ke dalam slot (lubang) pada blok '${block.type}'.`,
          `${block.type === "else-if" ? "else if" : block.type} (true)`,
          block.id,
        );
      }
    }
    if (block.children)
      block.children.forEach((c) => {
        if (!c.type.startsWith("op-")) validateConditionAttached(c);
      });
  }

  function isCompatibleType(objType, refType) {
    if (objType === refType) return true;
    if (refType === "Object") return true;

    const objClass = classBlocks.find((c) => c.data.name === objType);
    if (!objClass) return false;

    const extendsBlock = objClass.children.find((c) => c.type === "extends");
    if (extendsBlock && extendsBlock.data.superClass) {
      if (isCompatibleType(extendsBlock.data.superClass, refType)) return true;
    }

    const implementsBlocks = objClass.children.filter(
      (c) => c.type === "implements",
    );
    for (const implBlock of implementsBlocks) {
      if (implBlock.data.interfaces) {
        if (isCompatibleType(implBlock.data.interfaces, refType)) return true;
      }
    }

    return false;
  }

  function validateCompleteConnections(block) {
    if (block.type === "this") {
      const pill =
        block.children && block.children.find((c) => c.type.startsWith("op-"));
      if (
        !pill ||
        (pill.type === "op-value" && !(pill.data.value || "").trim())
      ) {
        reportError(
          "Pemanggilan Tidak Lengkap",
          `Blok keyword 'this' membutuhkan referensi atribut atau method.`,
          `Blok 'this' tidak boleh dibiarkan kosong.`,
          `Pasang blok nilai/teks ke lubang pada blok 'this' dan isi namanya.`,
          `this.property`,
          block.id,
        );
      }
    }

    if (block.type === "super") {
      const pill =
        block.children && block.children.find((c) => c.type.startsWith("op-"));
      if (pill && pill.type === "op-value" && !(pill.data.value || "").trim()) {
        reportError(
          "Pemanggilan Tidak Lengkap",
          `Terdapat blok nilai kosong yang menempel pada 'super'.`,
          `Hal ini akan menghasilkan kode 'super.' yang tidak valid di Java.`,
          `Isi nama atribut/method pada blok tersebut, atau lepaskan dari 'super' jika ingin memanggil super().`,
          `super.`,
          block.id,
        );
      }
    }

    if (block.type === "prop-assign") {
      const pill =
        block.children && block.children.find((c) => c.type.startsWith("op-"));
      if (!pill) {
        reportError(
          "Assignment Terputus",
          `Blok modifikasi properti '=' belum diberikan nilai.`,
          "",
          `Pasang blok nilai/operator ke sebelah kanan blok '='.`,
          `${block.data.name || "x"} =`,
          block.id,
        );
      }
    }

    if (block.type === "new-object") {
      validateName(
        block.data.objName,
        "variabel lokal",
        "Deklarasi Objek Baru",
        block.data.objName,
        block.id,
      );

      const refType = block.data.classRef || "Object";
      const objType = block.data.classObj || "Object";

      const isObjInterface = interfaceBlocks.some(
        (i) => i.data.name === objType,
      );
      if (isObjInterface) {
        reportError(
          "Instansiasi Interface",
          `Tidak dapat membuat wujud objek (new) dari interface '${objType}'.`,
          "Interface hanyalah sebuah cetak biru abstrak yang isinya kosong dan tidak bisa diinstansiasi secara langsung.",
          `Ubah bagian 'as new [${objType}]' menjadi class nyata yang mengimplementasikan interface tersebut.`,
          `new ${objType}`,
          block.id,
        );
      } else {
        if (!isCompatibleType(objType, refType)) {
          reportError(
            "Tipe Data Tidak Cocok (Polymorphism Error)",
            `Objek '${objType}' tidak dapat disimpan dalam variabel bertipe '${refType}'.`,
            `Dalam Java, objek harus bertipe sama dengan variabelnya atau merupakan subclass-nya.`,
            `Ubah tipe variabel menjadi '${objType}', atau pastikan class '${objType}' merupakan turunan (extends/implements) dari '${refType}'.`,
            `${refType} ${block.data.objName || "obj"} = new ${objType}`,
            block.id,
          );
        }
      }
    }

    if (block.children) block.children.forEach(validateCompleteConnections);
  }

  function isConstructorCall(block) {
    if (block.type !== "super") return false;
    const pill = block.children
      ? block.children.find((c) => c.type.startsWith("op-"))
      : null;

    if (!pill) return true;
    if (pill.type !== "op-value") return true;

    const val = (pill.data.value || "").trim();
    if (val === "") return false;
    if (val.startsWith("(")) return true;
    if (["true", "false", "null"].includes(val)) return true;
    if (/^[0-9]/.test(val) || val.startsWith('"') || val.startsWith("'"))
      return true;
    if (val.includes(",")) {
      if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\(.*\)$/.test(val)) return false;
      return true;
    }

    const memberRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*(\(.*\))?$/;
    if (!memberRegex.test(val)) return true;

    return false;
  }

  function validateSuperThis(
    nodes,
    context,
    depth,
    stmtIndexRef,
    isStatic = false,
    containerName = "",
  ) {
    nodes.forEach((node) => {
      if (node.type !== "parameter" && !node.type.startsWith("op-")) {
        if ((node.type === "this" || node.type === "super") && isStatic) {
          reportError(
            "Konteks Statis Tidak Valid",
            `Keyword '${node.type}' tidak dapat digunakan di dalam method static (seperti main).`,
            "Method static milik class itu sendiri, bukan milik objek (instansiasi), sehingga 'this' atau 'super' tidak memiliki referensi.",
            `Hapus blok '${node.type}' dari method ini.`,
            node.type,
            node.id,
          );
        }

        if (node.type === "super") {
          if (isConstructorCall(node)) {
            if (context !== "construct") {
              reportError(
                "Pemanggilan Tidak Valid",
                `'super()' hanya bisa dipanggil di dalam constructor.`,
                "",
                `Hanya gunakan 'super()' untuk menginisialisasi object induk. Untuk mengakses property, hapus tanda kurung atau koma.`,
                containerName ? `${containerName}(` : `super(`,
                node.id,
              );
            } else if (depth > 0 || stmtIndexRef.index > 0) {
              reportError(
                "Posisi Tidak Valid",
                `'super()' harus menjadi baris PERTAMA di dalam constructor.`,
                "",
                `Pindahkan blok 'super()' ke urutan paling atas di dalam constructor.`,
                `super(`,
                node.id,
              );
            }
          }
        }

        stmtIndexRef.index++;

        if (node.children) {
          validateSuperThis(
            node.children,
            context,
            depth + 1,
            stmtIndexRef,
            isStatic,
            containerName,
          );
        }
      }
    });
  }

  blocks.forEach(validateCompleteConnections);

  interfaceBlocks.forEach((interfaceBlock) => {
    validateName(
      interfaceBlock.data.name,
      "interface",
      "Workspace",
      "interface " + interfaceBlock.data.name,
      interfaceBlock.id,
    );

    const interfaceScopeVars = new Set();

    interfaceBlock.children.forEach((child) => {
      if (child.type === "interface-method") {
        validateName(
          child.data.name,
          "method",
          `interface ${interfaceBlock.data.name}`,
          child.data.name + "(",
          child.id,
        );
      }
      if (child.type === "variable" || child.type === "variable-value") {
        validateName(
          child.data.name,
          "atribut",
          `interface ${interfaceBlock.data.name}`,
          (child.data.type || "int") + " " + child.data.name,
          child.id,
        );

        if (child.type === "variable") {
          reportError(
            "Atribut Interface Tidak Valid",
            `Interface tidak boleh memiliki atribut yang tidak diinisialisasi.`,
            "Dalam interface atribut secara otomatis bersifat 'final' (konstan), sehingga wajib diberikan value.",
            `Ganti blok 'Atribut' dengan blok 'Atribut = Nilai', lalu berikan nilai padanya.`,
            `${child.data.type || "int"} ${child.data.name}`,
            child.id,
          );
        }
      }

      if (child.data.name) {
        if (interfaceScopeVars.has(child.data.name)) {
          let duplicateSearchTarget = child.data.name;
          if (child.type === "interface-method") {
            duplicateSearchTarget =
              (child.data.returnType || "void") + " " + child.data.name + "(";
          } else if (
            child.type === "variable" ||
            child.type === "variable-value"
          ) {
            duplicateSearchTarget =
              (child.data.type || "int") + " " + child.data.name;
          }

          reportError(
            "Nama Duplikat di Interface",
            `Nama '${child.data.name}' dibuat ganda di interface '${interfaceBlock.data.name}'.`,
            "Interface tidak boleh memiliki method atau atribut dengan nama yang persis sama.",
            "Ganti nama salah satu blok.",
            duplicateSearchTarget,
            child.id,
          );
        }
        interfaceScopeVars.add(child.data.name);
      }
    });
  });

  classBlocks.forEach((classBlock) => {
    const className = classBlock.data.name || "Main";
    validateName(
      className,
      "class",
      "Workspace",
      "class " + className,
      classBlock.id,
    );

    const classScopeVars = new Set();

    classBlock.children.forEach((child) => {
      if (child.type === "construct") {
        const constructName = child.data.name || "Main";
        if (constructName !== className) {
          reportError(
            "Nama Constructor Salah",
            `Nama constructor '${constructName}' tidak sesuai dengan nama class '${className}'.`,
            "",
            `Samakan nama blok constructor persis dengan '${className}'.`,
            `${constructName}(`,
            child.id,
          );
        }
      }

      if (
        child.type === "construct" ||
        child.type === "method" ||
        child.type === "main-method"
      ) {
        let stmtIndexRef = { index: 0 };
        let isMethodStatic =
          child.type === "main-method" || child.data.isStatic;
        let containerName = child.data.name;
        if (!containerName) {
          if (child.type === "main-method") containerName = "main";
          else if (child.type === "method") containerName = "myMethod";
          else containerName = className;
        }

        validateSuperThis(
          child.children,
          child.type,
          0,
          stmtIndexRef,
          isMethodStatic,
          containerName,
        );
      }

      if (child.type === "method" || child.type === "interface-method") {
        validateName(
          child.data.name,
          "method",
          "class " + className,
          child.data.name + "(",
          child.id,
        );
      }

      if (child.type === "variable" || child.type === "variable-value") {
        validateName(
          child.data.name,
          "atribut",
          "class " + className,
          (child.data.type || "int") + " " + child.data.name,
          child.id,
        );

        if (hasInputBlock([child])) {
          reportError(
            "Input Tidak Valid",
            `Scanner (Scan Input) tidak dapat dipasang langsung pada atribut class '${child.data.name}'.`,
            "Dalam Java, inisialisasi input yang membutuhkan Scanner harus dilakukan di dalam Method atau Constructor.",
            "Pindahkan scan input ke dalam Constructor atau Method.",
            `${child.data.type || "int"} ${child.data.name}`,
            child.id,
          );
        }

        if (classScopeVars.has(child.data.name)) {
          reportError(
            "Atribut Duplikat",
            `Atribut '${child.data.name}' dibuat ganda di class '${className}'.`,
            "Ruang lingkup class tidak boleh memiliki nama variabel yang identik.",
            "Ganti nama salah satu atribut.",
            `${child.data.type || "int"} ${child.data.name}`,
            child.id,
          );
        }
        classScopeVars.add(child.data.name);
      }

      if (
        child.type === "method" ||
        child.type === "interface-method" ||
        child.type === "main-method" ||
        child.type === "construct"
      ) {
        const localScopeVars = new Set();
        let methodName = child.data.name;
        if (!methodName) {
          if (child.type === "main-method") methodName = "main";
          else if (child.type === "method") methodName = "myMethod";
          else methodName = className;
        }
        const returnType = child.data.returnType || "void";

        if (child.type === "method" && returnType !== "void") {
          const hasReturn = checkHasReturnValue(child);
          if (!hasReturn) {
            reportError(
              "Return Hilang",
              `Method '${methodName}' berjanji mengembalikan data (${returnType}), tetapi tidak terdapat blok return atau value pada blok return.`,
              "",
              `Tambahkan blok 'return' beserta value-nya ke dalam method '${methodName}'.`,
              `${returnType} ${methodName}(`,
              child.id,
            );
          }
        }

        if (
          returnType === "void" ||
          child.type === "main-method" ||
          child.type === "construct"
        ) {
          const hasInvalidReturn = child.children.some(checkHasReturnValue);
          if (hasInvalidReturn) {
            const badReturn = child.children.find(checkHasReturnValue);
            reportError(
              "Return Tidak Valid",
              `Method bertipe void atau constructor tidak boleh menghasilkan kembalian nilai.`,
              "",
              "Gunakan blok return kosong atau ubah tipe balikan method.",
              "return ",
              badReturn ? badReturn.id : child.id,
            );
          }
        }

        function checkLocalVars(nodes) {
          nodes.forEach((innerChild) => {
            if (
              innerChild.type === "variable" ||
              innerChild.type === "variable-value" ||
              innerChild.type === "parameter"
            ) {
              validateName(
                innerChild.data.name,
                "variabel lokal",
                `method ${methodName}`,
                `${innerChild.data.type || "int"} ${innerChild.data.name}`,
                innerChild.id,
              );

              if (localScopeVars.has(innerChild.data.name)) {
                reportError(
                  "Variabel Lokal Duplikat",
                  `Variabel '${innerChild.data.name}' dibuat lebih dari sekali di dalam '${methodName}'.`,
                  "",
                  "Ganti nama salah satu variabel lokal.",
                  `${innerChild.data.type || "int"} ${innerChild.data.name}`,
                  innerChild.id,
                );
              }
              localScopeVars.add(innerChild.data.name);
            }
            if (innerChild.children) checkLocalVars(innerChild.children);
          });
        }
        checkLocalVars(child.children);
      }
    });

    if (classBlock.children) {
      classBlock.children.forEach(validateConditionAttached);
      checkOrphanedControlFlow(classBlock.children);
    }
  });

  // --- NEW SORTING LOGIC USING THE FLAG ---
  classBlocks.sort((a, b) => {
    const isAMain =
      a.data.name === "Main" ||
      a.children.some((c) => c.type === "main-method");
    const isBMain =
      b.data.name === "Main" ||
      b.children.some((c) => c.type === "main-method");

    if (isForExecution) {
      // Main goes to the top for the runner
      if (isAMain && !isBMain) return -1;
      if (!isAMain && isBMain) return 1;
    } else {
      // Main stays at the bottom for the UI
      if (isAMain && !isBMain) return 1;
      if (!isAMain && isBMain) return -1;
    }

    const depthA = getNodeDepth(a.data.name);
    const depthB = getNodeDepth(b.data.name);
    if (depthA !== depthB) return depthA - depthB;
    return (a.data.name || "").localeCompare(b.data.name || "");
  });

  // --- HELPER FUNCTIONS FOR GENERATION ---
  function processInterfaceBlock(block) {
    let extendsBlocks = block.children.filter((c) => c.type === "extends");
    let extendsStr = "";

    if (extendsBlocks.length > 0) {
      let interfacesList = [];
      extendsBlocks.forEach((extBlock) => {
        if (extBlock.data.superClass) {
          interfacesList.push(extBlock.data.superClass);
        }
      });
      if (interfacesList.length > 0) {
        extendsStr = ` extends ${interfacesList.join(", ")}`;
      }
    }

    code += `interface ${block.data.name}${extendsStr} {\n`;

    block.children.forEach((child) => {
      if (child.type === "variable" || child.type === "variable-value") {
        let typ = child.data.type || "int";
        let nam = child.data.name || "variable";
        let valStr = "";
        if (child.type === "variable-value" && child.data.value) {
          let val = child.data.value || "";
          if (typ === "String") {
            let cleanVal = val;
            val =
              cleanVal.startsWith('"') &&
              cleanVal.endsWith('"') &&
              cleanVal.length >= 2
                ? cleanVal
                : `"${cleanVal.replace(/"/g, '\\"')}"`;
          }
          valStr = ` = ${val}`;
        }
        code += `    ${typ} ${nam}${valStr};\n`;
      } else if (child.type === "interface-method") {
        let ret = child.data.returnType ? child.data.returnType + " " : "void ";
        let nam = child.data.name || "myMethod";

        let paramChildren = child.children.filter(
          (c) => c.type === "parameter",
        );
        let paramStrings = paramChildren.map(
          (p) => `${p.data.type || "int"} ${p.data.name || "p"}`,
        );

        code += `\n    ${ret}${nam}(${paramStrings.join(", ")});\n`;
      }
    });
    code += `}\n\n`;
  }

  function processClassBlock(block) {
    let rawClassAccess = (block.data.access || "").trim();
    let classAccess =
      rawClassAccess === "default" || rawClassAccess === ""
        ? ""
        : rawClassAccess + " ";

    if (isForExecution && classAccess.includes("public")) {
      classAccess = classAccess.replace("public ", "");
    }

    if (block.data.isAbstract) classAccess += "abstract ";
    if (block.data.isFinal) classAccess += "final ";

    let extendsBlock = block.children.find((c) => c.type === "extends");
    let extendsStr = extendsBlock
      ? ` extends ${extendsBlock.data.superClass}`
      : "";

    let implBlocks = block.children.filter((c) => c.type === "implements");
    let implStr = "";
    let overridableMethods = [];

    if (implBlocks.length > 0) {
      let interfacesList = [];
      implBlocks.forEach((implBlock) => {
        if (implBlock.data.interfaces) {
          interfacesList.push(implBlock.data.interfaces);

          // Grab methods for @Override tagging
          let iface = interfaceBlocks.find(
            (i) => i.data.name === implBlock.data.interfaces,
          );
          if (iface) {
            iface.children.forEach((c) => {
              if (c.type === "interface-method")
                overridableMethods.push(c.data.name);
            });
          }
        }
      });
      if (interfacesList.length > 0) {
        implStr = ` implements ${interfacesList.join(", ")}`;
      }
    }

    let currentSuperName = extendsBlock ? extendsBlock.data.superClass : null;
    let visitedSupers = new Set();

    while (currentSuperName) {
      if (visitedSupers.has(currentSuperName)) {
        break;
      }
      visitedSupers.add(currentSuperName);

      let superClass = classBlocks.find(
        (c) => c.data.name === currentSuperName,
      );
      if (superClass) {
        superClass.children.forEach((c) => {
          if (c.type === "method") overridableMethods.push(c.data.name);
        });
        let nextExtends = superClass.children.find((c) => c.type === "extends");
        currentSuperName = nextExtends ? nextExtends.data.superClass : null;
      } else currentSuperName = null;
    }

    code += `${classAccess}class ${block.data.name}${extendsStr}${implStr} {\n`;

    block.children.forEach((child) => {
      if (child.type === "construct") {
        let rawAccess = (child.data.access || "").trim();
        let acc =
          rawAccess === "default" || rawAccess === "" ? "" : rawAccess + " ";
        let nam = child.data.name || "Main";
        let paramChildren = child.children.filter(
          (c) => c.type === "parameter",
        );
        let paramStrings = paramChildren.map(
          (p) => `${p.data.type || "int"} ${p.data.name || "p"}`,
        );

        code += `\n    ${acc}${nam}(${paramStrings.join(", ")}) {\n`;

        let superNode = child.children.find(
          (c) => c.type === "super" && isConstructorCall(c),
        );
        let remainingNodes = child.children.filter((c) => c !== superNode);

        if (superNode) {
          generateInnerStatement(superNode, "        ", false);
        }

        if (hasInputBlock(child.children)) {
          code += `        Scanner scanner = new Scanner(System.in);\n`;
          if (remainingNodes.length > 0) code += `\n`;
        }

        generateBlockChildren(remainingNodes, "        ");
        code += `    }\n`;
      } else if (child.type === "main-method") {
        code += `\n    public static void main(String[] args) {\n`;
        if (hasInputBlock(child.children)) {
          code += `        Scanner scanner = new Scanner(System.in);\n`;
          const hasBody = child.children.some(
            (c) => c.type !== "parameter" && !c.type.startsWith("op-"),
          );
          if (hasBody) code += `\n`;
        }
        generateBlockChildren(child.children, "        ");
        code += `    }\n`;
      } else if (child.type === "method") {
        let rawAccess = (child.data.access || "").trim();
        let acc =
          rawAccess === "default" || rawAccess === "" ? "" : rawAccess + " ";

        if (child.data.isStatic) acc += "static ";
        if (child.data.isFinal) acc += "final ";
        if (child.data.isAbstract) acc += "abstract ";

        let ret = child.data.returnType ? child.data.returnType + " " : "void ";
        let nam = child.data.name || "myMethod";
        let paramChildren = child.children.filter(
          (c) => c.type === "parameter",
        );
        let paramStrings = paramChildren.map(
          (p) => `${p.data.type || "int"} ${p.data.name || "p"}`,
        );

        if (overridableMethods.includes(nam)) code += `\n    @Override\n`;
        else code += `\n`;

        code += `    ${acc}${ret}${nam}(${paramStrings.join(", ")}) {\n`;
        if (hasInputBlock(child.children)) {
          code += `        Scanner scanner = new Scanner(System.in);\n`;
          const hasBody = child.children.some(
            (c) => c.type !== "parameter" && !c.type.startsWith("op-"),
          );
          if (hasBody) code += `\n`;
        }
        generateBlockChildren(child.children, "        ");
        code += `    }\n`;
      } else if (child.type === "interface-method") {
        let rawAccess = (child.data.access || "").trim();
        let acc =
          rawAccess === "default" || rawAccess === "" ? "" : rawAccess + " ";

        let ret = child.data.returnType ? child.data.returnType + " " : "void ";
        let nam = child.data.name || "myMethod";
        let paramChildren = child.children.filter(
          (c) => c.type === "parameter",
        );
        let paramStrings = paramChildren.map(
          (p) => `${p.data.type || "int"} ${p.data.name || "p"}`,
        );

        // Include @Override if it matches an implemented interface method
        if (overridableMethods.includes(nam)) code += `\n    @Override\n`;
        else code += `\n`;

        code += `    ${acc}abstract ${ret}${nam}(${paramStrings.join(", ")});\n`;
      } else if (
        child.type !== "parameter" &&
        child.type !== "argument" &&
        child.type !== "extends" &&
        child.type !== "implements"
      ) {
        generateInnerStatement(child, "    ", false);
      }
    });
    code += `}\n\n`;
  }

  function generateInnerStatement(child, indent = "        ", isLocal = true) {
    let rawAccess =
      !isLocal && child.data.access ? child.data.access.trim() : "";
    let acc =
      rawAccess === "default" || rawAccess === "" ? "" : rawAccess + " ";

    if (!isLocal) {
      if (child.data.isStatic) acc += "static ";
      if (child.data.isFinal) acc += "final ";
    }

    let typ = child.data.type || "int";
    let nam = child.data.name || "variable";

    function getConditionString(ctrlBlock) {
      const opBlock = ctrlBlock.children
        ? ctrlBlock.children.find((c) => c.type.startsWith("op-"))
        : null;

      if (!opBlock) return "true";

      const type = opBlock.type;

      if (type === "op-value") return opBlock.data.value || "true";
      if (type === "op-inc") return `${opBlock.data.value || "x"}++`;
      if (type === "op-dec") return `${opBlock.data.value || "x"}--`;
      if (type === "op-not") return `!${opBlock.data.value || "true"}`;

      if (type === "op-input") {
        const inputTypes = {
          int: "Integer.parseInt(scanner.nextLine())",
          double: "Double.parseDouble(scanner.nextLine())",
          boolean: "Boolean.parseBoolean(scanner.nextLine())",
          String: "scanner.nextLine()",
        };
        return inputTypes[opBlock.data.type || "String"];
      }

      const operatorSymbols = {
        "op-add": "+",
        "op-sub": "-",
        "op-multi": "*",
        "op-div": "/",
        "op-mod": "%",
        "op-assign": "=",
        "op-less": "<",
        "op-greater": ">",
        "op-less-eq": "<=",
        "op-greater-eq": ">=",
        "op-equals": "==",
        "op-not-equals": "!=",
        "op-and": "&&",
        "op-or": "||",
      };

      let sym = operatorSymbols[type] || "==";
      return `${opBlock.data.left || "x"} ${sym} ${opBlock.data.right || "y"}`;
    }

    const statementStrategies = {
      "variable-value": () => {
        const pill = child.children
          ? child.children.find((c) => c.type.startsWith("op-"))
          : null;
        if (pill) {
          let val = getConditionString(child);

          if (typ === "String" && pill.type === "op-value") {
            if (!(val.startsWith('"') && val.endsWith('"'))) {
              val = `"${val.replace(/"/g, '\\"')}"`;
            }
          }

          code += `${indent}${acc}${typ} ${nam} = ${val};\n`;
        }
      },

      variable: () => {
        code += `${indent}${acc}${typ} ${nam};\n`;
      },

      "prop-assign": () => {
        code += `${indent}${child.data.name || "x"} = ${getConditionString(child)};\n`;
      },
      argument: () => {
        code += `${indent}${child.data.name || "arg"};\n`;
      },
      print: () => {
        let text = child.data.value || "";
        let parts = [];
        if (text) {
          let cleanText = text;
          parts.push(
            cleanText.startsWith('"') &&
              cleanText.endsWith('"') &&
              cleanText.length >= 2
              ? cleanText
              : `"${cleanText.replace(/"/g, '\\"')}"`,
          );
        }
        if (child.children) {
          child.children.forEach((arg) => {
            if (arg.type === "argument") {
              const hasPill =
                arg.children &&
                arg.children.some((c) => c.type.startsWith("op-"));
              // FIX: Use parts.push instead of args.push
              parts.push(
                hasPill ? getConditionString(arg) : arg.data.name || "arg",
              );
            }
          });
        }
        code += `${indent}System.out.println(${parts.length > 0 ? parts.join(" + ") : ""});\n`;
      },
      this: () => {
        const pill = child.children
          ? child.children.find((c) => c.type.startsWith("op-"))
          : null;
        if (pill) {
          let val =
            pill.type === "op-value"
              ? (pill.data.value || "").trim()
              : getConditionString(child);
          code += `${indent}this.${val || "property"};\n`;
        } else {
          code += `${indent}this.property;\n`;
        }
      },
      super: () => {
        const pill = child.children
          ? child.children.find((c) => c.type.startsWith("op-"))
          : null;
        if (pill) {
          let val =
            pill.type === "op-value"
              ? (pill.data.value || "").trim()
              : getConditionString(child);
          if (isConstructorCall(child)) {
            code +=
              val.startsWith("(") && val.endsWith(")")
                ? `${indent}super${val};\n`
                : `${indent}super(${val});\n`;
          } else {
            code += `${indent}super.${val};\n`;
          }
        } else {
          code += `${indent}super();\n`;
        }
      },
      "object-caller": () => {
        // 1. Look for the attached green method-call block
        let methodCallBlock = child.children
          ? child.children.find((c) => c.type === "method-call")
          : null;

        // 2. If it's missing, generate a placeholder so the user knows they forgot it
        if (!methodCallBlock) {
          code += `${indent}${child.data.objectName || "myObject"}. /* method missing */;\n`;
          return;
        }

        // 3. Process the arguments inside the attached method-call block
        let args = [];
        if (methodCallBlock.children) {
          methodCallBlock.children.forEach((arg) => {
            if (arg.type === "argument") {
              const hasPill =
                arg.children &&
                arg.children.some((c) => c.type.startsWith("op-"));
              args.push(
                hasPill ? getConditionString(arg) : arg.data.name || "arg",
              );
            }
          });
        }

        // 4. Combine the purple object, the dot, the green method, and the arguments
        code += `${indent}${child.data.objectName || "myObject"}.${methodCallBlock.data.methodName || "myMethod"}(${args.join(", ")});\n`;
      },
      if: () => {
        code += `${indent}if (${getConditionString(child)}) {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}}\n`;
      },
      "else-if": () => {
        code += `${indent}else if (${getConditionString(child)}) {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}}\n`;
      },
      else: () => {
        code += `${indent}else {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}}\n`;
      },
      switch: () => {
        code += `${indent}switch (${getConditionString(child)}) {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}}\n`;
      },
      case: () => {
        code += `${indent}case ${getConditionString(child)}:\n`;
        generateBlockChildren(child.children, indent + "    ");
      },
      for: () => {
        const init = child.data.Inisialisasi || child.data.init || "int i = 0";
        const cond = child.data.Kondisi || child.data.condition || "i < 10";
        const upd = child.data.Update || child.data.update || "i++";

        code += `${indent}for (${init}; ${cond}; ${upd}) {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}}\n`;
      },
      while: () => {
        code += `${indent}while (${getConditionString(child)}) {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}}\n`;
      },
      "do-while": () => {
        code += `${indent}do {\n`;
        generateBlockChildren(child.children, indent + "    ");
        code += `${indent}} while (${getConditionString(child)});\n`;
      },
      break: () => {
        code += `${indent}break;\n`;
      },
      continue: () => {
        code += `${indent}continue;\n`;
      },
      "new-object": () => {
        let args = [];
        if (child.children) {
          child.children.forEach((arg) => {
            if (arg.type === "argument") {
              const hasPill =
                arg.children &&
                arg.children.some((c) => c.type.startsWith("op-"));
              args.push(
                hasPill ? getConditionString(arg) : arg.data.name || "arg",
              );
            }
          });
        }
        code += `${indent}${child.data.classRef || "Object"} ${child.data.objName || "obj"} = new ${child.data.classObj || child.data.classRef || "Object"}(${args.join(", ")});\n`;
      },
      return: () => {
        const pill = child.children
          ? child.children.find((c) => c.type.startsWith("op-"))
          : null;
        if (pill) {
          let content = getConditionString(child);
          const needsParens = [
            "op-less",
            "op-greater",
            "op-less-eq",
            "op-greater-eq",
            "op-equals",
            "op-not-equals",
            "op-and",
            "op-or",
            "op-not",
          ].includes(pill.type);
          code += `${indent}return ${needsParens ? "(" + content + ")" : content};\n`;
        } else {
          code += `${indent}return;\n`;
        }
      },
    };

    if (statementStrategies[child.type]) {
      statementStrategies[child.type]();
    }
  }

  // --- NEW CONDITIONAL GENERATION ORDER ---
  if (isForExecution) {
    // Runner needs Class (Main) first, then Interfaces
    classBlocks.forEach(processClassBlock);
    interfaceBlocks.forEach(processInterfaceBlock);
  } else {
    // UI needs Interfaces first, then Classes
    interfaceBlocks.forEach(processInterfaceBlock);
    classBlocks.forEach(processClassBlock);
  }

  code = code.replace(/^[ \t]+$/gm, "");
  code = code.replace(/\n{3,}/g, "\n\n");
  code = code.replace(/\{[ \t]*\n+/g, "{\n");
  code = code.replace(/\n{2,}([ \t]*)\}/g, "\n$1}");

  return {
    code: code.trim() + "\n",
    error: error,
  };
}
